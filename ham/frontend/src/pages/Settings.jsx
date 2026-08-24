import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function Settings() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const status = params.get('calendar');

  async function connect() {
    setBusy(true);
    const { data } = await client.get('/calendar/oauth/connect');
    window.location.href = data.url;
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-clinical-900">Settings</h1>

      <div className="card p-6">
        <h2 className="mb-1 text-lg font-semibold text-clinical-900">Google Calendar</h2>
        <p className="mb-4 text-sm text-ink/60">
          Connect your calendar so booked appointments show up automatically, and update or disappear if they're
          rescheduled or cancelled.
        </p>

        {status === 'connected' && (
          <p className="mb-3 rounded-md bg-clinical-100 px-3 py-2 text-sm text-clinical-800">Calendar connected.</p>
        )}
        {status === 'error' && (
          <p className="mb-3 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            Something went wrong connecting your calendar. Please try again.
          </p>
        )}

        <p className="mb-3 text-sm text-ink/70">
          Status:{' '}
          {user?.googleCalendarConnected ? (
            <span className="font-medium text-clinical-700">Connected</span>
          ) : (
            <span className="font-medium text-amber-500">Not connected</span>
          )}
        </p>

        <button className="btn-primary" onClick={connect} disabled={busy}>
          {user?.googleCalendarConnected ? 'Reconnect calendar' : 'Connect Google Calendar'}
        </button>
      </div>
    </div>
  );
}
