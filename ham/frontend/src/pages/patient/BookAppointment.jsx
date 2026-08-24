import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../../api/client';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookAppointment() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [slotInfo, setSlotInfo] = useState({ slots: [], onLeave: false });
  const [loadingSlots, setLoadingSlots] = useState(true);

  const [step, setStep] = useState('pick'); // pick | symptoms | confirmed
  const [hold, setHold] = useState(null); // { appointment, holdExpiresAt }
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [symptomText, setSymptomText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] = useState(null);

  useEffect(() => {
    client.get(`/doctors/${id}`).then(({ data }) => setDoctor(data.doctor));
  }, [id]);

  useEffect(() => {
    setLoadingSlots(true);
    client
      .get(`/doctors/${id}/slots`, { params: { date } })
      .then(({ data }) => setSlotInfo(data))
      .finally(() => setLoadingSlots(false));
  }, [id, date]);

  // Countdown for the slot hold, so the patient knows they need to hurry.
  useEffect(() => {
    if (!hold?.holdExpiresAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(hold.holdExpiresAt) - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setError('Your hold on this slot expired. Please pick a time again.');
        setStep('pick');
        setHold(null);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [hold]);

  async function selectSlot(slot) {
    setError('');
    setBusy(true);
    try {
      const { data } = await client.post('/appointments/hold', {
        doctorProfileId: id,
        startTime: slot,
      });
      setHold(data);
      setStep('symptoms');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not hold that slot — it may have just been taken.');
      // Refresh availability since the slot we tried is likely gone now.
      const { data } = await client.get(`/doctors/${id}/slots`, { params: { date } });
      setSlotInfo(data);
    } finally {
      setBusy(false);
    }
  }

  async function submitSymptoms(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await client.post(`/appointments/${hold.appointment.id}/confirm`, { symptomText });
      setConfirmedAppointment(data.appointment);
      setStep('confirmed');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not confirm the appointment.');
    } finally {
      setBusy(false);
    }
  }

  if (!doctor) return <div className="mx-auto max-w-2xl px-6 py-10 text-ink/50">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <p className="font-mono text-xs uppercase tracking-wide text-clinical-500">{doctor.specialisation}</p>
      <h1 className="mb-6 text-2xl font-semibold text-clinical-900">
        Book with Dr. {doctor.user.firstName} {doctor.user.lastName}
      </h1>

      {error && <p className="mb-4 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}

      {step === 'pick' && (
        <div className="card p-6">
          <label className="label">Date</label>
          <input
            type="date"
            className="input mb-6 max-w-xs"
            value={date}
            min={todayStr()}
            onChange={(e) => setDate(e.target.value)}
          />

          {loadingSlots ? (
            <p className="text-ink/50">Loading available times…</p>
          ) : slotInfo.onLeave ? (
            <p className="text-amber-500">Dr. {doctor.user.lastName} is unavailable this day. Try another date.</p>
          ) : slotInfo.slots.length === 0 ? (
            <p className="text-ink/50">No open slots this day. Try another date.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slotInfo.slots.map((s) => (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => selectSlot(s)}
                  className="rounded-md border border-clinical-300 bg-white px-3 py-2 font-mono text-sm text-clinical-800 transition-colors hover:border-clinical-600 hover:bg-clinical-50 disabled:opacity-50"
                >
                  {new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'symptoms' && hold && (
        <form onSubmit={submitSymptoms} className="card space-y-4 p-6">
          <div className="flex items-center justify-between rounded-md bg-clinical-100 px-3 py-2 text-sm text-clinical-800">
            <span>
              Holding {new Date(hold.appointment.startTime).toLocaleString()}
            </span>
            <span className="font-mono">{secondsLeft !== null ? `${secondsLeft}s left` : ''}</span>
          </div>

          <div>
            <label className="label">What's going on?</label>
            <textarea
              className="input min-h-[120px]"
              required
              minLength={3}
              placeholder="Describe your symptoms — when they started, how severe, anything that makes them better or worse…"
              value={symptomText}
              onChange={(e) => setSymptomText(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink/50">
              Your doctor will see an AI-prepared summary of this before your visit, with an urgency flag and a
              few questions they may ask you.
            </p>
          </div>

          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setStep('pick')} disabled={busy}>
              Back
            </button>
            <button className="btn-primary flex-1" disabled={busy}>
              {busy ? 'Confirming…' : 'Confirm appointment'}
            </button>
          </div>
        </form>
      )}

      {step === 'confirmed' && confirmedAppointment && (
        <div className="card p-6 text-center">
          <h2 className="text-xl font-semibold text-clinical-900">You're booked</h2>
          <p className="mt-2 text-ink/70">
            {new Date(confirmedAppointment.startTime).toLocaleString()} with Dr. {doctor.user.lastName}
          </p>
          <p className="mt-1 text-sm text-ink/50">
            A confirmation email and calendar invite are on their way.
          </p>
          <button className="btn-primary mt-6" onClick={() => navigate('/patient/appointments')}>
            View my appointments
          </button>
        </div>
      )}
    </div>
  );
}
