'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/cloudstock';
import { TableSkeleton } from '@/components/ui';
import { PlusIcon, XIcon } from '@/components/ui/Icons';

type Role = 'admin' | 'staff' | 'viewer';
type UserRow = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
};

const labels: Record<Role, string> = {
  admin: 'Administrator',
  staff: 'Warehouse Staff',
  viewer: 'Report Viewer',
};

export default function UserManagement({ ownId }: { ownId: string }) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'staff' as Role,
  });

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await apiRequest<UserRow[]>('/users'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    apiRequest<UserRow[]>('/users')
      .then((data) => {
        if (!active) return;
        setRows(data);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Unable to load user accounts.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const action = async (fn: () => Promise<unknown>, success: string) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await fn();
      await reload();
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      setSaving(false);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await action(async () => {
      await apiRequest('/users', { method: 'POST', body: JSON.stringify(form) });
      setShowCreate(false);
      setForm({ displayName: '', email: '', password: '', role: 'staff' });
    }, 'User account created successfully.');
  };

  return (
    <section className="panel user-management">
      <div className="panel-head">
        <div>
          <h2>User Management</h2>
          <p>Administer team members, access roles, and account statuses.</p>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            setShowCreate(!showCreate);
            setError('');
            setMessage('');
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          {showCreate ? <XIcon size={16} /> : <PlusIcon size={16} />}
          <span>{showCreate ? 'Close' : 'Add User'}</span>
        </button>
      </div>

      {error && (
        <p className="user-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="user-success" role="status">
          {message}
        </p>
      )}

      {showCreate && (
        <form className="user-create" onSubmit={create}>
          <label>
            Full Name
            <input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              required
              maxLength={120}
              placeholder="Staff Name"
            />
          </label>
          <label>
            Email Address
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              placeholder="email@company.com"
            />
          </label>
          <label>
            Initial Password
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              placeholder="At least 10 characters"
            />
          </label>
          <label>
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              <option value="staff">Warehouse Staff</option>
              <option value="viewer">Report Viewer</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? 'Saving...' : 'Create Account'}
          </button>
        </form>
      )}

      {loading ? (
        <TableSkeleton rows={5} cols={5} hasAvatar={false} />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.display_name || 'Not provided'}</strong>
                    <div className="user-secondary">{u.email || 'No email'}</div>
                  </td>
                  <td>
                    <select
                      aria-label={`Role for ${u.display_name}`}
                      disabled={saving || u.id === ownId}
                      value={u.role}
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        if (!window.confirm(`Change role of ${u.display_name} to ${labels[role]}?`)) return;
                        void action(
                          () =>
                            apiRequest(`/users/${u.id}/role`, {
                              method: 'PATCH',
                              body: JSON.stringify({ role }),
                            }),
                          'User role updated successfully.'
                        );
                      }}
                    >
                      <option value="admin">Administrator</option>
                      <option value="staff">Warehouse Staff</option>
                      <option value="viewer">Report Viewer</option>
                    </select>
                  </td>
                  <td>
                    <span className={'tag ' + (u.is_active ? 'success' : 'danger')}>
                      {u.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString('en-US')}</td>
                  <td>
                    <button
                      className={'small-btn ' + (u.is_active ? 'red' : '')}
                      disabled={saving || u.id === ownId}
                      title={u.id === ownId ? 'You cannot alter your own account status' : ''}
                      onClick={() => {
                        const isActive = !u.is_active;
                        if (!window.confirm(`${isActive ? 'Activate' : 'Suspend'} account for ${u.display_name}?`))
                          return;
                        void action(
                          () =>
                            apiRequest(`/users/${u.id}/status`, {
                              method: 'PATCH',
                              body: JSON.stringify({ isActive }),
                            }),
                          isActive ? 'Account activated successfully.' : 'Account suspended successfully.'
                        );
                      }}
                    >
                      {u.id === ownId ? 'Current User' : u.is_active ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5}>No user accounts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="user-status">
        Suspended accounts cannot sign in or interact with the API. Administrators cannot modify their own status or role.
      </p>
    </section>
  );
}
