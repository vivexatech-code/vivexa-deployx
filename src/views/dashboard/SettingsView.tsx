import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { authService } from '../../services/auth.service';
import { githubService } from '../../services/github.service';
import { User, Lock, GitBranch, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { navigate } = useRouter();

  const [name, setName] = useState(profile?.name || user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || user?.photoURL || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [ghConnected, setGhConnected] = useState(false);
  const [ghUsername, setGhUsername] = useState('');
  const [disconnectingGh, setDisconnectingGh] = useState(false);

  const [resetSent, setResetSent] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [connectingGh, setConnectingGh] = useState(false);

  useEffect(() => {
    if (user) {
      githubService.getGitHubConnection(user.uid).then((conn) => {
        if (conn && (conn.githubUsername || (conn as any).username)) {
          setGhConnected(true);
          setGhUsername(conn.githubUsername || (conn as any).username || 'Connected');
        }
      });
    }
  }, [user]);

  const handleConnectGitHub = async () => {
    if (!user) return;
    setConnectingGh(true);
    try {
      const res = await githubService.initiateOAuthConnect(user.uid);
      setGhConnected(true);
      setGhUsername(res.username);
    } catch (err: any) {
      alert(err.message || 'Failed to connect GitHub');
    } finally {
      setConnectingGh(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      await authService.updateProfileData(user.uid, {
        name: name.trim(),
        photoURL: photoURL.trim(),
      });
      await refreshProfile();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    if (!user || !confirm('Disconnect GitHub account? You can reconnect anytime.')) return;
    setDisconnectingGh(true);
    try {
      await githubService.disconnectGitHub(user.uid);
      setGhConnected(false);
      setGhUsername('');
    } catch (err: any) {
      alert(err.message || 'Failed to disconnect GitHub');
    } finally {
      setDisconnectingGh(false);
    }
  };

  const handleSendReset = async () => {
    if (!user?.email) return;
    try {
      await authService.resetPassword(user.email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to send reset link');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = prompt(
      'Type "DELETE MY ACCOUNT" to permanently delete your account, projects, and deployments:'
    );
    if (confirmation !== 'DELETE MY ACCOUNT' || !user) return;

    setDeleting(true);
    try {
      await authService.deleteAccount(user.uid);
      await signOut();
      navigate('/');
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Account Settings
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your personal profile, credentials, and connected integrations.
        </p>
      </div>

      {/* Profile Form */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600" />
          Personal Profile
        </h2>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Full Name
            </label>
            <input
              id="input-settings-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Avatar Image URL
            </label>
            <input
              type="url"
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              id="btn-settings-save"
              type="submit"
              disabled={savingProfile}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
            {profileSaved && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Updated successfully
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Connected Accounts */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-indigo-600" />
          Connected Integrations
        </h2>

        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
              GH
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 block">GitHub</span>
              <span className="text-[11px] text-slate-500">
                {ghConnected ? `Connected as @${ghUsername}` : 'Not connected'}
              </span>
            </div>
          </div>

          {ghConnected ? (
            <button
              onClick={handleDisconnectGitHub}
              disabled={disconnectingGh}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-white cursor-pointer"
            >
              {disconnectingGh ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <button
              onClick={handleConnectGitHub}
              disabled={connectingGh}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {connectingGh ? 'Connecting...' : 'Connect GitHub'}
            </button>
          )}
        </div>
      </div>

      {/* Security & Password */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Lock className="w-4 h-4 text-indigo-600" />
          Security & Credentials
        </h2>
        <p className="text-xs text-slate-500">
          Request a password reset link to be dispatched to your registered email address.
        </p>

        <button
          onClick={handleSendReset}
          className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          Send Password Reset Email
        </button>

        {resetSent && (
          <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Email sent. Check your inbox.
          </p>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-rose-50/50 p-6 sm:p-8 rounded-2xl border border-rose-200 space-y-4">
        <h2 className="text-sm font-bold text-rose-900 flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-rose-600" />
          Danger Zone
        </h2>
        <p className="text-xs text-rose-700">
          Permanently delete your account and all associated projects, custom domains, and Vercel edge deployments.
        </p>
        <button
          id="btn-delete-account"
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete Account & All Data'}
        </button>
      </div>
    </div>
  );
};
