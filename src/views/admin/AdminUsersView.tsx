'use client';

import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/admin.service';
import { UserProfile } from '../../types';
import { Users, Search, ShieldCheck, User } from 'lucide-react';

export const AdminUsersView: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      const list = await adminService.getAllUsers(search);
      setUsers(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [search]);

  const handleToggleRole = async (user: UserProfile) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change role of ${user.email} to "${nextRole}"?`)) return;

    setUpdatingUid(user.uid);
    try {
      await adminService.updateUserRole(user.uid, nextRole);
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, role: nextRole } : u))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update user role');
    } finally {
      setUpdatingUid(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            User Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View registered developer accounts, manage role permissions, and search members.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading user accounts...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No user accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <th className="py-3 px-6">User</th>
                  <th className="py-3 px-6">Email</th>
                  <th className="py-3 px-6">Role</th>
                  <th className="py-3 px-6">Plan Status</th>
                  <th className="py-3 px-6">Joined Date</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                          {u.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span>{u.name || 'Unnamed Developer'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 font-mono">
                      {u.email}
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          u.role === 'admin'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      {u.subscriptionStatus === 'active' && u.planId ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {u.planId.toUpperCase()} &bull; PAID
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                          NO PLAN
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500 whitespace-nowrap">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => handleToggleRole(u)}
                        disabled={updatingUid === u.uid}
                        className="px-3 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                      >
                        {u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
