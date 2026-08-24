import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge.jsx';

export default function Queue() {
  const [appointments, setAppointments] = useState(null);

  useEffect(() => {
    client.get('/appointments').then(({ data }) => setAppointments(data.appointments));
  }, []);

  const upcoming = appointments?.filter((a) => a.status === 'BOOKED') || [];
  const others = appointments?.filter((a) => a.status !== 'BOOKED') || [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-clinical-900">Your appointments</h1>

      {!appointments ? (
        <p className="text-ink/50">Loading…</p>
      ) : (
        <>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-clinical-800/60">Upcoming</h2>
          {upcoming.length === 0 ? (
            <p className="mb-8 text-sm text-ink/50">Nothing booked right now.</p>
          ) : (
            <div className="mb-8 space-y-3">
              {upcoming.map((a) => (
                <Link key={a.id} to={`/doctor/appointments/${a.id}`} className="card flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-ink">
                      {a.patient.firstName} {a.patient.lastName}
                    </p>
                    <p className="text-sm text-ink/50">{new Date(a.startTime).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.aiUrgency && <StatusBadge value={a.aiUrgency} />}
                    <StatusBadge value={a.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}

          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-clinical-800/60">History</h2>
          <div className="space-y-3">
            {others.map((a) => (
              <Link key={a.id} to={`/doctor/appointments/${a.id}`} className="card flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-ink">
                    {a.patient.firstName} {a.patient.lastName}
                  </p>
                  <p className="text-sm text-ink/50">{new Date(a.startTime).toLocaleString()}</p>
                </div>
                <StatusBadge value={a.status} />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
