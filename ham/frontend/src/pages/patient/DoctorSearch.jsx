import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';

export default function DoctorSearch() {
  const [doctors, setDoctors] = useState([]);
  const [specialisation, setSpecialisation] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(spec) {
    setLoading(true);
    const { data } = await client.get('/doctors', { params: spec ? { specialisation: spec } : {} });
    setDoctors(data.doctors);
    setLoading(false);
  }

  useEffect(() => {
    load('');
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-clinical-900">Find a doctor</h1>
          <p className="text-sm text-ink/60">Search by specialisation, or browse everyone.</p>
        </div>
        <Link to="/patient/appointments" className="btn-secondary">
          My appointments
        </Link>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(specialisation);
        }}
        className="mb-6 flex gap-2"
      >
        <input
          className="input"
          placeholder="e.g. Dermatology, Cardiology…"
          value={specialisation}
          onChange={(e) => setSpecialisation(e.target.value)}
        />
        <button className="btn-primary shrink-0">Search</button>
      </form>

      {loading ? (
        <p className="text-ink/50">Loading doctors…</p>
      ) : doctors.length === 0 ? (
        <p className="text-ink/50">No doctors match that search.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {doctors.map((d) => (
            <Link
              key={d.id}
              to={`/patient/doctors/${d.id}`}
              className="card p-5 transition-shadow hover:shadow-md"
            >
              <p className="font-display text-lg font-semibold text-clinical-900">
                Dr. {d.user.firstName} {d.user.lastName}
              </p>
              <p className="mt-1 text-sm font-medium text-clinical-600">{d.specialisation}</p>
              {d.bio && <p className="mt-2 text-sm text-ink/60 line-clamp-2">{d.bio}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
