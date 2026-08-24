import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const emptyHour = () => ({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' });

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '',
    specialisation: '', bio: '', slotDurationMinutes: 20,
  });
  const [workingHours, setWorkingHours] = useState([emptyHour()]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await client.get('/admin/doctors');
    setDoctors(data.doctors);
  }

  useEffect(() => {
    load();
  }, []);

  function set(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  function updateHour(i, field, value) {
    setWorkingHours((h) => h.map((w, idx) => (idx === i ? { ...w, [field]: value } : w)));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await client.post('/admin/doctors', { ...form, workingHours });
      setShowForm(false);
      setForm({ firstName: '', lastName: '', email: '', phone: '', password: '', specialisation: '', bio: '', slotDurationMinutes: 20 });
      setWorkingHours([emptyHour()]);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create doctor');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-clinical-900">Doctors</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'Add doctor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card mb-8 space-y-4 p-6">
          {error && <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First name</label>
              <input className="input" required value={form.firstName} onChange={set('firstName')} />
            </div>
            <div>
              <label className="label">Last name</label>
              <input className="input" required value={form.lastName} onChange={set('lastName')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="label">Temporary password</label>
              <input className="input" type="text" minLength={8} required value={form.password} onChange={set('password')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Specialisation</label>
              <input className="input" required value={form.specialisation} onChange={set('specialisation')} />
            </div>
            <div>
              <label className="label">Slot duration (minutes)</label>
              <input
                className="input"
                type="number"
                min={5}
                max={180}
                value={form.slotDurationMinutes}
                onChange={(e) => setForm({ ...form, slotDurationMinutes: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <label className="label">Bio</label>
            <textarea className="input" value={form.bio} onChange={set('bio')} />
          </div>

          <div>
            <label className="label">Working hours</label>
            <div className="space-y-2">
              {workingHours.map((w, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <select className="input" value={w.dayOfWeek} onChange={(e) => updateHour(i, 'dayOfWeek', Number(e.target.value))}>
                    {DAYS.map((d, idx) => (
                      <option key={idx} value={idx}>{d}</option>
                    ))}
                  </select>
                  <input type="time" className="input" value={w.startTime} onChange={(e) => updateHour(i, 'startTime', e.target.value)} />
                  <input type="time" className="input" value={w.endTime} onChange={(e) => updateHour(i, 'endTime', e.target.value)} />
                </div>
              ))}
            </div>
            <button type="button" className="mt-2 text-sm font-medium text-clinical-700 hover:underline" onClick={() => setWorkingHours((h) => [...h, emptyHour()])}>
              + Add day
            </button>
          </div>

          <button className="btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create doctor account'}
          </button>
        </form>
      )}

      {!doctors ? (
        <p className="text-ink/50">Loading…</p>
      ) : (
        <div className="space-y-3">
          {doctors.map((d) => (
            <Link key={d.id} to={`/admin/doctors/${d.id}`} className="card flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-ink">Dr. {d.user.firstName} {d.user.lastName}</p>
                <p className="text-sm text-ink/50">{d.specialisation} &middot; {d.slotDurationMinutes}-min slots</p>
              </div>
              <span className="text-sm text-clinical-600">{d.leaveDays.length} leave day(s)</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
