import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge.jsx';

export default function AppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appt, setAppt] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await client.get(`/appointments/${id}`);
    setAppt(data.appointment);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function cancel() {
    if (!confirm('Cancel this appointment?')) return;
    setBusy(true);
    try {
      await client.post(`/appointments/${id}/cancel`, {});
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!appt) return <div className="mx-auto max-w-2xl px-6 py-10 text-ink/50">Loading…</div>;

  const canCancel = ['BOOKED', 'HELD'].includes(appt.status) && new Date(appt.startTime) > new Date();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-clinical-700 hover:underline">
        ← Back
      </button>

      <div className="card p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-clinical-900">
              Dr. {appt.doctorProfile.user.firstName} {appt.doctorProfile.user.lastName}
            </h1>
            <p className="text-sm text-ink/60">{new Date(appt.startTime).toLocaleString()}</p>
          </div>
          <StatusBadge value={appt.status} />
        </div>

        {appt.symptomText && (
          <div className="mb-4 border-t border-clinical-100 pt-4">
            <p className="label">What you shared</p>
            <p className="text-sm text-ink/80">{appt.symptomText}</p>
          </div>
        )}

        {appt.aiPostVisitSummary && (
          <div className="mb-4 border-t border-clinical-100 pt-4">
            <p className="label">Visit summary</p>
            <p className="whitespace-pre-line text-sm text-ink/80">{appt.aiPostVisitSummary}</p>
          </div>
        )}
        {appt.status === 'COMPLETED' && !appt.aiPostVisitSummary && (
          <div className="mb-4 border-t border-clinical-100 pt-4">
            <p className="label">Visit summary</p>
            <p className="text-sm text-ink/60">
              Your doctor's notes are recorded, but a plain-language summary couldn't be generated automatically.
              Contact the clinic if you'd like it explained.
            </p>
          </div>
        )}

        {canCancel && (
          <button onClick={cancel} disabled={busy} className="btn-danger mt-4">
            {busy ? 'Cancelling…' : 'Cancel appointment'}
          </button>
        )}
      </div>
    </div>
  );
}
