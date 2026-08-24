import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();
  const home = { PATIENT: '/patient', DOCTOR: '/doctor', ADMIN: '/admin' }[user?.role];

  return (
    <div className="mx-auto max-w-4xl px-6 py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-clinical-500">Appointments, made calm</p>
      <h1 className="mt-4 font-display text-5xl font-semibold leading-tight text-clinical-900">
        Book a visit. Share what's going on.
        <br /> Walk in already understood.
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-ink/60">
        Meridian Clinic pairs every booking with a short symptom note your doctor reviews before you arrive,
        and a plain-language summary of what happened after.
      </p>
      <div className="mt-10 flex justify-center gap-4">
        {user ? (
          <Link to={home} className="btn-primary">
            Go to your dashboard
          </Link>
        ) : (
          <>
            <Link to="/register" className="btn-primary">
              Book an appointment
            </Link>
            <Link to="/login" className="btn-secondary">
              Log in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
