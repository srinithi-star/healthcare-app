import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const roleHome = { PATIENT: '/patient', DOCTOR: '/doctor', ADMIN: '/admin' };

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      navigate(roleHome[user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not log in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="mb-1 text-3xl font-semibold text-clinical-900">Welcome back</h1>
      <p className="mb-8 text-sm text-ink/60">Log in to manage your appointments.</p>

      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        {error && <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        New here?{' '}
        <Link to="/register" className="font-medium text-clinical-700 hover:text-clinical-900">
          Create a patient account
        </Link>
      </p>
    </div>
  );
}
