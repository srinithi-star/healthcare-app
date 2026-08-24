import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge.jsx';

export default function MyAppointments() {
  const [appointments, setAppointments] = useState(null);

  useEffect(() => {
    client.get('/appointments').then(({ data }) => setAppointments(data.appointments));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-clinical-900">My appointments</h1>
        <Link to="/patient" className="btn-primary">
          Book new
        </Link>
      </div>

      {!appointments ? (
        <p className="text-ink/50">Loading…</p>
      ) : appointments.length === 0 ? (
        <p className="text-ink/50">No appointments yet.</p>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <Link key={a.id} to={`/patient/appointments/${a.id}`} className="card flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-ink">
                  Dr. {a.doctorProfile.user.firstName} {a.doctorProfile.user.lastName}
                </p>
                <p className="text-sm text-ink/50">{new Date(a.startTime).toLocaleString()}</p>
              </div>
              <StatusBadge value={a.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
