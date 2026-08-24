import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge.jsx';

const emptyDrug = () => ({ drug: '', dose: '', frequency: 'Twice daily', durationDays: 5 });

export default function VisitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appt, setAppt] = useState(null);
  const [notes, setNotes] = useState('');
  const [prescription, setPrescription] = useState([emptyDrug()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get(`/appointments/${id}`).then(({ data }) => setAppt(data.appointment));
  }, [id]);

  function updateDrug(idx, field, value) {
    setPrescription((p) => p.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const cleanPrescription = prescription.filter((d) => d.drug.trim());
      const { data } = await client.post(`/appointments/${id}/complete`, {
        clinicalNotes: notes,
        prescription: cleanPrescription,
      });
      setAppt(data.appointment);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not complete the visit.');
    } finally {
      setBusy(false);
    }
  }

  if (!appt) return <div className="mx-auto max-w-2xl px-6 py-10 text-ink/50">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-clinical-700 hover:underline">
        ← Back
      </button>

      <div className="card mb-6 p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-clinical-900">
              {appt.patient.firstName} {appt.patient.lastName}
            </h1>
            <p className="text-sm text-ink/60">{new Date(appt.startTime).toLocaleString()}</p>
          </div>
          <StatusBadge value={appt.status} />
        </div>

        <div className="border-t border-clinical-100 pt-4">
          <p className="label">Patient-reported symptoms</p>
          <p className="mb-4 text-sm text-ink/80">{appt.symptomText}</p>

          <p className="label">AI pre-visit summary</p>
          {appt.aiUrgency ? (
            <div className="space-y-2 rounded-md bg-clinical-50 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">Urgency</span>
                <StatusBadge value={appt.aiUrgency} />
              </div>
              <p className="text-sm text-ink/80">
                <span className="font-medium">Chief complaint:</span> {appt.aiChiefComplaint}
              </p>
              {Array.isArray(appt.aiSuggestedQuestions) && (
                <div>
                  <p className="text-sm font-medium text-ink">Suggested questions</p>
                  <ul className="ml-4 list-disc text-sm text-ink/80">
                    {appt.aiSuggestedQuestions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-amber-500">
              AI summary unavailable ({appt.aiPreVisitError || 'not generated'}). Review the symptoms above directly.
            </p>
          )}
        </div>
      </div>

      {appt.status === 'BOOKED' ? (
        <form onSubmit={submit} className="card space-y-4 p-6">
          <h2 className="text-lg font-semibold text-clinical-900">Complete visit</h2>
          {error && <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}

          <div>
            <label className="label">Clinical notes</label>
            <textarea
              className="input min-h-[100px]"
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Findings, diagnosis, treatment plan…"
            />
          </div>

          <div>
            <label className="label">Prescription</label>
            <div className="space-y-2">
              {prescription.map((d, i) => (
                <div key={i} className="grid grid-cols-4 gap-2">
                  <input
                    className="input"
                    placeholder="Drug"
                    value={d.drug}
                    onChange={(e) => updateDrug(i, 'drug', e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Dose (e.g. 500mg)"
                    value={d.dose}
                    onChange={(e) => updateDrug(i, 'dose', e.target.value)}
                  />
                  <select
                    className="input"
                    value={d.frequency}
                    onChange={(e) => updateDrug(i, 'frequency', e.target.value)}
                  >
                    <option>Once daily</option>
                    <option>Twice daily</option>
                    <option>Three times daily</option>
                    <option>Four times daily</option>
                    <option>Every 8 hours</option>
                  </select>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    placeholder="Days"
                    value={d.durationDays}
                    onChange={(e) => updateDrug(i, 'durationDays', Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-clinical-700 hover:underline"
              onClick={() => setPrescription((p) => [...p, emptyDrug()])}
            >
              + Add medication
            </button>
          </div>

          <button className="btn-primary" disabled={busy}>
            {busy ? 'Completing…' : 'Complete visit & notify patient'}
          </button>
        </form>
      ) : appt.status === 'COMPLETED' ? (
        <div className="card p-6">
          <h2 className="mb-2 text-lg font-semibold text-clinical-900">Notes on file</h2>
          <p className="whitespace-pre-line text-sm text-ink/80">{appt.clinicalNotes}</p>
        </div>
      ) : null}
    </div>
  );
}
