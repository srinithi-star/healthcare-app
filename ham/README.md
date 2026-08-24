# Healthcare Appointment & Follow-up Manager

A full-stack clinic platform with separate patient, doctor, and admin portals. Patients book
appointments and share symptoms in advance; doctors get an AI pre-visit summary before each visit
and produce a patient-friendly post-visit summary; both sides get email and Google Calendar
notifications throughout.

- **Backend:** Node.js, Express, PostgreSQL (Prisma ORM)
- **Frontend:** React (Vite), Tailwind CSS
- **LLM:** Anthropic Claude API (pre-visit and post-visit summaries)
- **Email:** Nodemailer (any SMTP provider — SendGrid, Mailgun, etc.)
- **Calendar:** Google Calendar API via OAuth 2.0
- **Background jobs:** node-cron (reminders, notification retries, hold cleanup)

See `SYSTEM_DESIGN.md` for the write-up on double-booking prevention, doctor-leave conflict
handling, the slot-hold mechanism, and notification failure handling.

---

## 1. Project structure

```
backend/
  prisma/schema.prisma      # DB schema (Users, DoctorProfiles, Appointments, Notifications, ...)
  prisma/seed.js             # Seeds an initial admin account
  src/
    app.js, server.js        # Express app + entrypoint
    config/                  # Prisma client, logger
    controllers/              # Route handlers
    routes/                   # Route definitions
    middleware/                # Auth, error handling
    services/                   # Business logic: booking, slots, LLM, email, calendar, notifications, visits
    jobs/                       # Cron job: reminders, retries, hold cleanup
    utils/                      # Auth helpers, Joi validators
frontend/
  src/
    pages/{patient,doctor,admin,auth}/  # Portal pages
    components/                          # NavBar, ProtectedRoute, StatusBadge
    context/AuthContext.jsx              # Auth state
    api/client.js                        # Axios instance with token injection
```

---

## 2. Prerequisites

- Node.js 18+
- A PostgreSQL database (local or hosted — e.g. Supabase, Neon, Railway)
- An Anthropic API key (for the LLM features)
- An SMTP account (SendGrid, Mailgun, or similar) — optional, but required to actually send email
- A Google Cloud project with the Calendar API enabled — optional, required for calendar sync

None of the AI/email/calendar integrations are required for the app to run: each is designed to
degrade gracefully (see Section 6) so you can get the core booking flow working first, then layer
integrations in.

---

## 3. Backend setup

```bash
cd backend
cp .env.example .env      # fill in DATABASE_URL at minimum
npm install
npx prisma migrate dev --name init   # creates tables from prisma/schema.prisma
npm run seed                          # creates an admin account (see console output for credentials)
npm run dev                           # starts the API on http://localhost:4000
```

Key `.env` values (full list with comments in `.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signs auth tokens — set to a long random string |
| `ANTHROPIC_API_KEY` | Enables pre-visit/post-visit AI summaries |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Enables email sending |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Enables calendar sync |
| `SLOT_HOLD_MINUTES` | How long a slot hold lasts before release (default 5) |
| `REMINDER_CRON` | Cron schedule for the background sweep (default every 5 minutes) |

Once seeded, log in as the admin (credentials printed by `npm run seed`) and use
`POST /api/admin/doctors` (or the Admin portal UI) to add doctors — they aren't self-registered.

---

## 4. Frontend setup

```bash
cd frontend
cp .env.example .env      # set VITE_API_URL if backend isn't on localhost:4000
npm install
npm run dev                # starts on http://localhost:5173
```

Roles and their landing routes: `PATIENT → /patient`, `DOCTOR → /doctor`, `ADMIN → /admin`.
Patients self-register at `/register`; doctor and admin accounts are created by an admin.

---

## 5. Google Calendar setup (OAuth 2.0)

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (or reuse one)
   and enable the **Google Calendar API**.
2. Go to **APIs & Services → OAuth consent screen**, configure it (External is fine for testing;
   add your test users' emails while the app is unverified), and add the scope
   `https://www.googleapis.com/auth/calendar.events`.
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**, application
   type **Web application**. Add an authorized redirect URI matching
   `GOOGLE_REDIRECT_URI` in your `.env`, e.g. `http://localhost:4000/api/calendar/oauth/callback`.
4. Copy the generated **Client ID** and **Client Secret** into the backend `.env`.
5. In the app, a logged-in patient or doctor visits **Settings → Connect Google Calendar**, which
   redirects to Google's consent screen and back. From then on, booking/cancelling/rescheduling an
   appointment automatically creates/updates/deletes an event on that user's primary calendar.

Calendar sync is per-user and independent for the patient and the doctor — if only one side has
connected their calendar, that side still gets an event; the other simply doesn't, and nothing
about the booking itself is blocked either way (see `SYSTEM_DESIGN.md`).

---

## 6. LLM prompts and failure handling

Both prompts are implemented in `backend/src/services/llmService.js` and instruct the model to
return a single JSON object, which the service then validates and parses defensively (stripping
any stray prose/markdown fences a model might add despite instructions).

**Pre-visit summary** (triggered when a patient confirms a booking with a symptom description):

> Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and
> three suggested questions for the doctor. Symptoms: `<symptoms>`

**Post-visit summary** (triggered when a doctor submits clinical notes + prescription):

> Convert these clinical notes into a patient-friendly summary with medication schedule and
> follow-up steps: `<notes>`

**Failure handling:** every LLM call has a 15-second hard timeout and returns a uniform
`{ ok, data | error }` result — it never throws. If the call fails (no API key, timeout, non-200
response, or malformed/unparseable JSON), the appointment or visit-completion still proceeds
normally: the `aiPreVisitError` / `aiPostVisitError` field is set, the doctor/patient UI shows a
plain fallback message, and the raw symptoms/notes remain fully visible so no clinical information
is ever hidden behind a failed AI call.

---

## 7. API overview

All endpoints are under `/api` and (except register/login) require `Authorization: Bearer <token>`.

| Method & path | Role | Purpose |
|---|---|---|
| `POST /auth/register` | public | Patient self-registration |
| `POST /auth/login` | public | Login (all roles) |
| `GET /auth/me` | any | Current user |
| `POST /admin/doctors` | admin | Create a doctor account + profile + working hours |
| `GET /admin/doctors` | admin | List doctors with hours & leave |
| `PUT /admin/doctors/:id/working-hours` | admin | Replace a doctor's weekly hours |
| `POST /admin/doctors/:id/leave` | admin | Add a leave day (cancels conflicting bookings, notifies patients) |
| `DELETE /admin/leave/:id` | admin | Remove a leave day |
| `GET /doctors` | any | Search doctors by specialisation |
| `GET /doctors/:id/slots?date=YYYY-MM-DD` | any | Available slots for a day |
| `POST /appointments/hold` | patient | Place a short-lived hold on a slot |
| `POST /appointments/:id/confirm` | patient | Submit symptoms, confirm booking, trigger AI + email + calendar |
| `POST /appointments/:id/cancel` | patient/doctor/admin | Cancel an appointment |
| `POST /appointments/:id/complete` | doctor | Submit notes + prescription, trigger AI summary + medication reminders |
| `GET /appointments` | any | List appointments scoped to the caller's role |
| `GET /appointments/:id` | any (owner) | Appointment detail |
| `GET /calendar/oauth/connect` | patient/doctor | Get Google consent URL |
| `GET /calendar/oauth/callback` | — | OAuth redirect target |

---

## 8. Database schema (summary)

Full definitions in `backend/prisma/schema.prisma`. Key relationships:

- `User` — one row per person, `role` enum (`PATIENT` / `DOCTOR` / `ADMIN`). Holds Google OAuth
  tokens directly, since both patients and doctors can connect their own calendar.
- `DoctorProfile` — 1:1 with a `User`, holds `specialisation`, `slotDurationMinutes`, and relations
  to `WorkingHour` (recurring weekly availability) and `LeaveDay` (specific dates off).
- `Appointment` — the central table. `status` is `HELD → BOOKED → COMPLETED` (or `CANCELLED` /
  `NO_SHOW` off that path). Carries both the pre-visit AI fields (`aiUrgency`, `aiChiefComplaint`,
  `aiSuggestedQuestions`, `aiPreVisitError`) and post-visit fields (`clinicalNotes`, `prescription`,
  `aiPostVisitSummary`, `aiPostVisitError`), plus the Google event IDs for both parties.
  **`@@unique([doctorProfileId, startTime])`** is what makes double-booking structurally
  impossible — see `SYSTEM_DESIGN.md`.
- `MedicationReminder` — generated from the prescription's frequency/duration when a visit is
  completed; swept by the background job.
- `Notification` — every email attempt (confirmation, reminder, cancellation, leave-conflict,
  medication reminder) is logged here with `status`/`attempts`, which is what makes retries
  possible instead of "fire and forget."

---

## 9. Deployment

Any Node-friendly host works (Render, Railway, Fly.io, a VPS, etc.):

1. Provision a PostgreSQL instance (Render/Railway/Neon/Supabase all have free tiers) and set
   `DATABASE_URL`.
2. Deploy `backend/` as a web service: build command `npm install && npx prisma generate`, start
   command `npx prisma migrate deploy && npm start`. Set all `.env` values as environment
   variables in the host's dashboard.
3. Deploy `frontend/` as a static site (Vercel/Netlify/Render static site): build command
   `npm install && npm run build`, publish directory `dist`, with `VITE_API_URL` pointing at the
   deployed backend's `/api`.
4. Update `FRONTEND_URL` (backend) and `GOOGLE_REDIRECT_URI` to the deployed URLs, and add the
   deployed callback URL to the Google OAuth client's authorized redirect URIs.

---

## 10. Local development tips

- `npx prisma studio` — browse/edit the database visually.
- Without `SMTP_HOST` set, emails are logged to the console instead of sent — useful for local
  testing without a real mail provider.
- Without `ANTHROPIC_API_KEY` set, AI summaries are skipped and the UI shows the graceful fallback
  described in Section 6 — the booking/visit flow itself is unaffected.
- The reminder/retry cron job runs every 5 minutes by default (`REMINDER_CRON`); lower it for
  faster local testing of reminders and retries.
