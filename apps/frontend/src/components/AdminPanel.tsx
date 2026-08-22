import React, { useEffect, useState } from 'react';
import { ShieldCheck, UserPlus, KeyRound, Lock, Trash2, CheckCircle2, ShieldAlert, RefreshCw, Eye, EyeOff, User } from 'lucide-react';
import { apiRequest } from '../api/client';

export const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Staff Assignment Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStaffId, setNewStaffId] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newRole, setNewRole] = useState<'STAFF' | 'ADMIN'>('STAFF');
  const [creating, setCreating] = useState(false);

  // Password Reset Modal State
  const [resetTargetUser, setResetTargetUser] = useState<any | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [showResetPasswordVal, setShowResetPasswordVal] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/api/admin/users');
      if (res.success && res.users) {
        setUsers(res.users);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch staff accounts.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffId.trim() || !newName.trim() || !newPassword.trim()) {
      setError('Staff ID, Full Name, and Password are required.');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          staffId: newStaffId.trim(),
          name: newName.trim(),
          email: newEmail.trim() || undefined,
          password: newPassword.trim(),
          role: newRole,
        }),
      });

      if (res.success) {
        setSuccessMsg(`Successfully created staff account ${res.user.staffId} (${res.user.name})!`);
        setShowCreateModal(false);
        setNewStaffId('');
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        fetchUsers();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to assign staff credentials.');
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !resetPasswordVal.trim()) return;

    setResetting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiRequest(`/api/admin/users/${resetTargetUser.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword: resetPasswordVal.trim() }),
      });

      if (res.success) {
        setSuccessMsg(`Password reset successfully for ${resetTargetUser.staffId} (${resetTargetUser.name})!`);
        setResetTargetUser(null);
        setResetPasswordVal('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (user.staffId === 'ADMIN001') {
      alert('Primary administrator account (ADMIN001) cannot be deleted.');
      return;
    }

    if (!confirm(`Are you sure you want to delete staff account ${user.staffId} (${user.name})?`)) {
      return;
    }

    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiRequest(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      });

      if (res.success) {
        setSuccessMsg(`Staff account ${user.staffId} deleted successfully.`);
        fetchUsers();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete user.');
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  return (
    <div className="p-3 sm:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 bg-slate-50 min-h-screen w-full box-border overflow-x-hidden">
      {/* Admin Panel Header */}
      <div className="border-b border-slate-200 pb-4 sm:pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 text-emerald-600 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Admin Credentials Control</h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Assign Staff IDs, Manage Roles & Reset Authorized Passwords
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setNewPassword(generateRandomPassword());
            setShowCreateModal(true);
          }}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Assign New Staff ID & Password</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs sm:text-sm flex items-center gap-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs sm:text-sm flex items-center gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Staff Accounts Management Table */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden w-full max-w-full box-border">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-600" />
            <span>Authorized Staff Account Directory ({users.length})</span>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            title="Refresh Account List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-800">
            <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider font-bold text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 sm:px-6 py-3.5">Staff ID</th>
                <th className="px-4 sm:px-6 py-3.5">Full Name & Email</th>
                <th className="px-4 sm:px-6 py-3.5">System Role</th>
                <th className="px-4 sm:px-6 py-3.5">Created Date</th>
                <th className="px-4 sm:px-6 py-3.5 text-right">Credential Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold">
                      <span className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                      <span>Loading staff credentials directory...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-xs font-medium">
                    No staff accounts found. Click "Assign New Staff ID & Password" above to create one.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 sm:px-6 py-4 font-mono font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>{u.staffId}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{u.email}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono border ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-900 border-purple-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-xs font-mono text-slate-600">
                      {new Date(u.createdAt).toISOString().split('T')[0]}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setResetTargetUser(u);
                            setResetPasswordVal(generateRandomPassword());
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center gap-1.5 shadow-2xs transition-all"
                          title="Reset Password"
                        >
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Reset Password</span>
                        </button>

                        {u.staffId !== 'ADMIN001' && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            title="Delete Staff Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW STAFF ACCOUNT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                <span>Assign New Staff ID & Password</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Staff ID (Login ID) *
                </label>
                <input
                  type="text"
                  value={newStaffId}
                  onChange={(e) => setNewStaffId(e.target.value)}
                  placeholder="e.g. STAFF003"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Dr. Jane Smith"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. jane.smith@ivfclinic.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Assigned Password *</span>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateRandomPassword())}
                    className="text-[10px] text-emerald-700 hover:underline font-bold lowercase"
                  >
                    🎲 Generate Random
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Set account password"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  System Role *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'STAFF' | 'ADMIN')}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="STAFF">STAFF (Embryologist / Clinic Doctor)</option>
                  <option value="ADMIN">ADMIN (Full Admin Access)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {creating ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Save & Assign Credentials</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetTargetUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-600" />
                <span>Reset Password for {resetTargetUser.staffId}</span>
              </div>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="text-xs text-slate-600">
                Staff Name: <strong className="text-slate-900">{resetTargetUser.name}</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>New Password *</span>
                  <button
                    type="button"
                    onClick={() => setResetPasswordVal(generateRandomPassword())}
                    className="text-[10px] text-emerald-700 hover:underline font-bold lowercase"
                  >
                    🎲 Generate Random
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showResetPasswordVal ? 'text' : 'password'}
                    value={resetPasswordVal}
                    onChange={(e) => setResetPasswordVal(e.target.value)}
                    placeholder="Enter new password (min 6 chars)"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPasswordVal(!showResetPasswordVal)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showResetPasswordVal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {resetting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Confirm New Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
