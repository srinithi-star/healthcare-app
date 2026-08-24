import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/patient');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="mb-1 text-3xl font-semibold text-clinical-900">Create your account</h1>
      <p className="mb-8 text-sm text-ink/60">
        Patient registration. Doctor and admin accounts are set up by the clinic.
      </p>

      <form onSubmit={onSubmit} className="card space-y-4 p-6">
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
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={set('phone')} />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            minLength={8}
            required
            value={form.password}
            onChange={set('password')}
          />
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-clinical-700 hover:text-clinical-900">
          Log in
        </Link>
      </p>
    </div>
  );
}
