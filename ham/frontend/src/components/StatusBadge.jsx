const STYLES = {
  HELD: 'bg-clinical-100 text-clinical-700',
  BOOKED: 'bg-clinical-100 text-clinical-800',
  CANCELLED: 'bg-rose-500/10 text-rose-500',
  COMPLETED: 'bg-clinical-800/10 text-clinical-900',
  NO_SHOW: 'bg-amber-500/10 text-amber-500',
  LOW: 'bg-clinical-100 text-clinical-700',
  MEDIUM: 'bg-amber-500/10 text-amber-500',
  HIGH: 'bg-rose-500/10 text-rose-500',
};

export default function StatusBadge({ value }) {
  if (!value) return null;
  return <span className={`badge ${STYLES[value] || 'bg-ink/10 text-ink/70'}`}>{value.replace('_', ' ')}</span>;
}
