import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { githubService } from '../../services/github.service';
import { projectService } from '../../services/project.service';
import { domainService } from '../../services/domain.service';
import { ROOT_DOMAIN, FRAMEWORK_PRESETS } from '../../config/constants';
import { GitHubRepo, GitHubBranch } from '../../types';
import {
  GitBranch,
  Search,
  Check,
  Globe,
  Lock,
  Plus,
  Trash2,
  Rocket,
  AlertCircle,
  FolderGit2,
  ArrowLeft,
  RefreshCw,
  LogOut,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export const NewProjectView: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();

  // GitHub Connection State
  const [hasGitHub, setHasGitHub] = useState(false);
  const [connectingGh, setConnectingGh] = useState(false);
  const [disconnectingGh, setDisconnectingGh] = useState(false);
  const [ghUsername, setGhUsername] = useState('');
  const [ghAvatar, setGhAvatar] = useState('');

  // Repositories State
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [searchRepo, setSearchRepo] = useState('');
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Selected Configuration
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Project Settings
  const [projectName, setProjectName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [framework, setFramework] = useState('vite');
  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [outputDirectory, setOutputDirectory] = useState('dist');
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);

  const [deploying, setDeploying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Load existing GitHub connection
  useEffect(() => {
    if (user) {
      githubService.getGitHubConnection(user.uid).then((conn) => {
        if (conn && (conn.githubUsername || (conn as any).username)) {
          setHasGitHub(true);
          setGhUsername(conn.githubUsername || (conn as any).username || 'Connected');
          setGhAvatar(conn.githubAvatar || '');
          loadRepositories();
        }
      });
    }
  }, [user]);

  // Handle Connect GitHub via direct official OAuth flow
  const handleConnectGitHub = async () => {
    if (!user) return;
    setConnectingGh(true);
    setErrorMsg(null);
    try {
      const res = await githubService.initiateOAuthConnect(user.uid);
      setHasGitHub(true);
      setGhUsername(res.username);
      setGhAvatar(res.avatarUrl || '');
      setSuccessNotice(`Successfully authorized as @${res.username}`);
      setTimeout(() => setSuccessNotice(null), 4000);
      await loadRepositories();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect to GitHub. Please check OAuth credentials.');
    } finally {
      setConnectingGh(false);
    }
  };

  // Handle Disconnect GitHub
  const handleDisconnectGitHub = async () => {
    if (!user) return;
    const confirmed = window.confirm(
      'Are you sure you want to disconnect your GitHub account? Existing deployed projects will remain active, but you will not be able to import new repositories until you reconnect.'
    );
    if (!confirmed) return;

    setDisconnectingGh(true);
    setErrorMsg(null);
    try {
      await githubService.disconnectGitHub(user.uid);
      setHasGitHub(false);
      setGhUsername('');
      setGhAvatar('');
      setRepos([]);
      setSelectedRepo(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to disconnect GitHub account.');
    } finally {
      setDisconnectingGh(false);
    }
  };

  const loadRepositories = async () => {
    if (!user) return;
    setLoadingRepos(true);
    setErrorMsg(null);
    try {
      const list = await githubService.getRepositories(user.uid);
      setRepos(list);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not fetch repositories from GitHub.');
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleSelectRepo = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setProjectName(repo.name);
    // Suggest clean subdomain from repo name
    const cleanSub = repo.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 24);
    setSubdomain(cleanSub);

    if (user) {
      setLoadingBranches(true);
      try {
        const bList = await githubService.getBranches(user.uid, repo.owner.login, repo.name);
        setBranches(bList);
        setSelectedBranch(repo.default_branch || bList[0]?.name || 'main');

        const detectedFw = await githubService.detectFramework(user.uid, repo.owner.login, repo.name);
        setFramework(detectedFw);
        const preset = githubService.getPresetDefaults(detectedFw);
        setBuildCommand(preset.buildCommand);
        setOutputDirectory(preset.outputDirectory);
      } catch (err) {
        console.warn('Branch or framework fetch note:', err);
      } finally {
        setLoadingBranches(false);
      }
    }
  };

  const handleFrameworkChange = (fwId: string) => {
    setFramework(fwId);
    const preset = githubService.getPresetDefaults(fwId);
    setBuildCommand(preset.buildCommand);
    setOutputDirectory(preset.outputDirectory);
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (index: number, key: string, value: string) => {
    const next = [...envVars];
    next[index] = { key, value };
    setEnvVars(next);
  };

  const handleDeploy = async () => {
    if (!user || !selectedRepo) return;

    setErrorMsg(null);

    // Validate subdomain
    const subCheck = domainService.validateSubdomain(subdomain);
    if (!subCheck.valid) {
      setErrorMsg(subCheck.error || 'Invalid subdomain.');
      return;
    }

    setDeploying(true);

    try {
      const envRecord: Record<string, string> = {};
      envVars.forEach((v) => {
        if (v.key.trim()) envRecord[v.key.trim()] = v.value;
      });

      const { project } = await projectService.createProject({
        userId: user.uid,
        name: projectName.trim(),
        subdomain: subCheck.normalized,
        repositoryId: String(selectedRepo.id),
        repositoryName: selectedRepo.name,
        repositoryOwner: selectedRepo.owner.login,
        repositoryUrl: selectedRepo.html_url,
        branch: selectedBranch,
        framework,
        buildCommand,
        outputDirectory,
        envVars: envRecord,
      });

      navigate(`/dashboard/projects/${project.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Deployment could not be initiated.');
    } finally {
      setDeploying(false);
    }
  };

  // Filter repos by search and visibility
  const filteredRepos = repos.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchRepo.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchRepo.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterVisibility === 'public') return !r.private;
    if (filterVisibility === 'private') return r.private;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/projects')}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Import Git Repository
          </h1>
          <p className="text-xs text-slate-500">
            Deploy full-stack applications with automated CI/CD and free Vivexa HTTPS subdomains.
          </p>
        </div>
      </div>

      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="font-semibold">{successNotice}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Notice</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* STEP 1: Connect GitHub (Official OAuth Flow) */}
      {!hasGitHub ? (
        <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-2xs space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold mx-auto shadow-sm">
            <FolderGit2 className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Connect to GitHub</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Authorize Vivexa Hosting with your GitHub account to seamlessly import private and public repositories, inspect branches, and configure automated deployments.
            </p>
          </div>

          <div className="pt-2">
            <button
              id="btn-connect-gh"
              type="button"
              disabled={connectingGh}
              onClick={handleConnectGitHub}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {connectingGh ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Connecting to GitHub...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  Connect GitHub
                </>
              )}
            </button>
          </div>

          <div className="pt-4 flex items-center justify-center gap-6 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Secure OAuth Authorization
            </span>
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Private Repositories Supported
            </span>
          </div>
        </div>
      ) : !selectedRepo ? (
        /* STEP 2: Select Repository */
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          {/* Connected Account Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              {ghAvatar ? (
                <img
                  src={ghAvatar}
                  alt={ghUsername}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                  GH
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">Connected as @{ghUsername}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                    Active
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 block">
                  GitHub account linked with authorization for private & public repositories
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadRepositories}
                disabled={loadingRepos}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRepos ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                disabled={disconnectingGh}
                onClick={handleDisconnectGitHub}
                className="px-3 py-1.5 rounded-lg border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Disconnect
              </button>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterVisibility('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  filterVisibility === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Repositories ({repos.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterVisibility('public')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  filterVisibility === 'public'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Public ({repos.filter((r) => !r.private).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterVisibility('private')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  filterVisibility === 'private'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Private ({repos.filter((r) => r.private).length})
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchRepo}
                onChange={(e) => setSearchRepo(e.target.value)}
                placeholder="Search repositories..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Repository List */}
          {loadingRepos ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
              <span>Fetching repositories from GitHub...</span>
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              {searchRepo ? 'No repositories matched your search filter.' : 'No repositories found for this account.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto border border-slate-100 rounded-xl">
              {filteredRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={() => handleSelectRepo(repo)}
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 truncate">
                        {repo.name}
                      </span>
                      {repo.private ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                          <Lock className="w-2.5 h-2.5" /> Private
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                          <Globe className="w-2.5 h-2.5" /> Public
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">
                        {repo.default_branch}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-1">
                      {repo.description || 'No repository description'}
                    </p>
                  </div>

                  <button
                    id={`btn-import-${repo.name}`}
                    type="button"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0 cursor-pointer"
                  >
                    Import
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* STEP 3: Configure and Deploy */
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                Configuring Project
              </span>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-indigo-600" />
                {selectedRepo.full_name}
              </h2>
            </div>
            <button
              onClick={() => setSelectedRepo(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              Choose different repo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Project Name
              </label>
              <input
                id="input-project-name"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Branch to Deploy
              </label>
              <select
                id="select-project-branch"
                value={selectedBranch}
                disabled={loadingBranches}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none font-mono"
              >
                {branches.length > 0 ? (
                  branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))
                ) : (
                  <option value={selectedRepo.default_branch || 'main'}>
                    {selectedRepo.default_branch || 'main'}
                  </option>
                )}
              </select>
            </div>
          </div>

          {/* Subdomain configuration */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-900">
              Free Vivexa Subdomain
            </label>
            <div className="flex items-center">
              <input
                id="input-subdomain"
                type="text"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="my-awesome-site"
                className="w-full px-3 py-2 rounded-l-lg border border-slate-300 bg-white text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
              <span className="px-3 py-2 bg-slate-200 border-y border-r border-slate-300 rounded-r-lg text-xs font-mono font-bold text-slate-700 select-none">
                .{ROOT_DOMAIN}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Your application will be live over SSL at{' '}
              <span className="font-mono font-semibold text-indigo-600">
                https://{subdomain || '...'}.{ROOT_DOMAIN}
              </span>
            </p>
          </div>

          {/* Framework preset */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Framework Preset
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {FRAMEWORK_PRESETS.map((fw) => (
                <button
                  key={fw.id}
                  type="button"
                  onClick={() => handleFrameworkChange(fw.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    framework === fw.id
                      ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 font-bold'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs block">{fw.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Build settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Build Command
              </label>
              <input
                type="text"
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                placeholder="npm run build"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Output Directory
              </label>
              <input
                type="text"
                value={outputDirectory}
                onChange={(e) => setOutputDirectory(e.target.value)}
                placeholder="dist"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Environment Variables */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-900">
                Environment Variables (Optional)
              </label>
              <button
                type="button"
                onClick={addEnvVar}
                className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Variable
              </button>
            </div>

            {envVars.map((ev, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="KEY"
                  value={ev.key}
                  onChange={(e) => updateEnvVar(i, e.target.value, ev.value)}
                  className="w-1/2 px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs"
                />
                <input
                  type="text"
                  placeholder="VALUE"
                  value={ev.value}
                  onChange={(e) => updateEnvVar(i, ev.key, e.target.value)}
                  className="w-1/2 px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => removeEnvVar(i)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setSelectedRepo(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-deploy-submit"
              type="button"
              disabled={deploying}
              onClick={handleDeploy}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
            >
              <Rocket className="w-4 h-4" />
              {deploying ? 'Deploying to Vercel...' : 'Deploy Project'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
