# System Design Write-up

## Double-booking prevention

The temptation with slot booking is to check availability, then insert — but that "check then
act" pattern always has a race window: two patients can both pass the availability check for the
same slot microseconds apart and both proceed to book. Rather than trying to close that window
with application-level locks (which only work within a single process and add complexity), the
schema encodes the invariant directly: `Appointment` has a composite unique constraint on
`(doctorProfileId, startTime)`. This means the database itself refuses to let two rows exist for
the same doctor at the same instant, regardless of how many concurrent requests arrive or how the
application code is structured. When two simultaneous booking attempts race, Postgres lets exactly
one `INSERT` succeed; the second raises a unique-violation error (Prisma error code `P2002`), which
the global error handler translates into a clean `409 Conflict` — "that slot was just taken."
Concurrency safety is guaranteed by the storage layer, not by hoping the application logic never
has a gap.

## Slot hold mechanism

Booking isn't a single action — a patient picks a time, then fills in a symptom form, and only
then is the appointment confirmed. If the slot weren't reserved during that gap, someone else could
take it while the first patient is still typing. To handle this without inventing a separate
"reservations" concept, an `Appointment` row is created immediately when a slot is selected, with
`status = HELD` and a `holdExpiresAt` timestamp five minutes out (configurable via
`SLOT_HOLD_MINUTES`). This row occupies the same unique `(doctorProfileId, startTime)` slot as a
real booking, so it's protected by the identical database constraint described above — a hold is
just an appointment that hasn't been confirmed yet, not a parallel mechanism that could itself
introduce a race. If the patient completes the symptom form in time, `confirmBooking` flips the
status to `BOOKED` and clears the expiry. If they abandon the flow, two things reclaim the slot:
`slotService` treats any `HELD` row whose `holdExpiresAt` has passed as vacant when computing
availability (so the next patient sees it as free immediately, even before cleanup runs), and
`holdSlot` opportunistically deletes any expired hold on that exact slot before inserting a new
one. A background cron sweep (`releaseExpiredHolds`) also periodically garbage-collects expired
holds so they don't accumulate. The result: a slot is never permanently lost to an abandoned
booking attempt, and there's no separate expiry mechanism to keep in sync with the booking table.

## Doctor leave conflict handling

Leave is entered after bookings can already exist for that date, so marking a doctor unavailable
has to actively reconcile the schedule rather than just record a fact. `addLeaveDay` upserts the
`LeaveDay` row (which also blocks that date from future slot generation) and then synchronously
calls `handleDoctorLeaveConflicts`, which finds every `BOOKED` appointment for that doctor on that
date, cancels each one, deletes both parties' Google Calendar events, and sends the patient a
dedicated `DOCTOR_LEAVE` email — distinct from a generic cancellation, so the patient understands
the clinic initiated it and isn't left wondering if they made an error. The admin who set the leave
day gets an immediate count of how many appointments were affected, so the disruption is visible at
the moment it's caused rather than discovered later through patient complaints. This is
deliberately synchronous rather than queued: leave-conflict cancellation is rare, bounded in size
(a single doctor's single day), and the admin benefits from seeing the result immediately rather
than polling for a background job to finish.

## Notification failure handling

Email delivery is the one part of this system that depends on a third-party service with its own
uptime and rate limits, so it's treated as unreliable by design rather than assumed to succeed. No
booking, cancellation, or visit-completion action is blocked on email sending — `queueAndSend`
writes a `Notification` row (`status: PENDING`) before attempting delivery, so the *fact* that a
notification was owed is durable even if the send itself fails immediately after. If `sendEmail`
returns an error, the row moves to `RETRYING` (or `FAILED` once `attempts` hits a ceiling of 5) with
the error message recorded. The same background cron that sweeps expired holds and due reminders
also calls `retryFailedNotifications`, which re-attempts every `RETRYING`/`PENDING` notification
under the attempt ceiling. This turns a transient SMTP outage into a delayed delivery rather than a
silently lost one, and gives an operator a concrete, queryable list (`Notification.status = FAILED`)
of what genuinely needs manual attention, instead of an opaque "did the email go out?" question.
