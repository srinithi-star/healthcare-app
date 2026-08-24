import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../../api/client';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AdminDoctorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    const { data } = await client.get('/admin/doctors');
    setDoctor(data.doctors.find((d) => d.id === id));
  }

  useEffect(() => {
    load();
  }, [id]);

  async function addLeave(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const { data } = await client.post(`/admin/doctors/${id}/leave`, { date: leaveDate, reason: leaveReason });
      setMessage(
        data.cancelledAppointments > 0
          ? `Leave added. ${data.cancelledAppointments} existing appointment(s) were cancelled and patients notified.`
          : 'Leave day added.'
      );
      setLeaveDate('');
      setLeaveReason('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeLeave(leaveId) {
    await client.delete(`/admin/leave/${leaveId}`);
    await load();
  }

  if (!doctor) return <div className="mx-auto max-w-2xl px-6 py-10 text-ink/50">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-clinical-700 hover:underline">
        ← Back
      </button>

      <h1 className="mb-1 text-2xl font-semibold text-clinical-900">
        Dr. {doctor.user.firstName} {doctor.user.lastName}
      </h1>
      <p className="mb-6 text-sm text-ink/60">{doctor.specialisation}</p>

      <div className="card mb-6 p-6">
        <h2 className="mb-3 text-lg font-semibold text-clinical-900">Working hours</h2>
        {doctor.workingHours.length === 0 ? (
          <p className="text-sm text-ink/50">No working hours set.</p>
        ) : (
          <ul className="space-y-1 text-sm text-ink/80">
            {doctor.workingHours.map((w) => (
              <li key={w.id}>
                {DAYS[w.dayOfWeek]}: {w.startTime}–{w.endTime}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-6">
        <h2 className="mb-3 text-lg font-semibold text-clinical-900">Leave days</h2>
        {message && <p className="mb-3 rounded-md bg-clinical-100 px-3 py-2 text-sm text-clinical-800">{message}</p>}

        <form onSubmit={addLeave} className="mb-4 grid grid-cols-3 gap-2">
          <input type="date" className="input" required value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} />
          <input className="input" placeholder="Reason (optional)" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
          <button className="btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add leave day'}</button>
        </form>

        {doctor.leaveDays.length === 0 ? (
          <p className="text-sm text-ink/50">No leave days scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {doctor.leaveDays.map((l) => (
              <li key={l.id} className="flex items-center justify-between text-sm">
                <span>
                  {new Date(l.date).toLocaleDateString()} {l.reason && `— ${l.reason}`}
                </span>
                <button className="text-rose-500 hover:underline" onClick={() => removeLeave(l.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
