import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const roleHome = { PATIENT: '/patient', DOCTOR: '/doctor', ADMIN: '/admin' };

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-clinical-200/70 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to={user ? roleHome[user.role] : '/'} className="flex items-baseline gap-2">
          <span className="font-display text-xl font-semibold text-clinical-800">Meridian Clinic</span>
          <span className="hidden font-mono text-[11px] uppercase tracking-widest text-clinical-500 sm:inline">
            appointments
          </span>
        </Link>

        {user ? (
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-ink/70 sm:inline">
              {user.firstName} {user.lastName} &middot; <span className="capitalize">{user.role.toLowerCase()}</span>
            </span>
            {user.role === 'PATIENT' && (
              <Link to="/settings" className="text-sm font-medium text-clinical-700 hover:text-clinical-900">
                Settings
              </Link>
            )}
            {user.role === 'DOCTOR' && (
              <Link to="/settings" className="text-sm font-medium text-clinical-700 hover:text-clinical-900">
                Settings
              </Link>
            )}
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="btn-secondary !py-1.5"
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-clinical-700 hover:text-clinical-900">
              Log in
            </Link>
            <Link to="/register" className="btn-primary !py-1.5">
              Register
            </Link>
          </div>
        )}
      </div>
      <div className="pulse-rule" />
    </header>
  );
}
