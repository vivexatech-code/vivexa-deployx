'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { githubService } from '../../services/github.service';
import { projectService } from '../../services/project.service';
import { planService } from '../../services/plan.service';
import { FRAMEWORK_PRESETS } from '../../config/constants';
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
  FolderTree,
  CheckCircle2,
  AlertTriangle,
  Loader2,
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
  const [rootDirectory, setRootDirectory] = useState('');
  const [candidateRootDirs, setCandidateRootDirs] = useState<string[]>([]);
  const [framework, setFramework] = useState('vite');
  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [outputDirectory, setOutputDirectory] = useState('dist');
  const [installCommand, setInstallCommand] = useState('npm install');
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);

  const [inspectingRepo, setInspectingRepo] = useState(false);
  const [inspectionNotice, setInspectionNotice] = useState<{
    type: 'success' | 'warning' | 'info';
    text: string;
    details?: string;
  } | null>(null);

  const [deploying, setDeploying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [hasActiveSub, setHasActiveSub] = useState<boolean | null>(null);

  // Load existing GitHub connection and check plan entitlement
  useEffect(() => {
    if (user) {
      planService.getUserUsage(user.uid).then((usage) => {
        setHasActiveSub(usage.hasActiveSubscription);
      });

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

  const runInspection = async (
    owner: string,
    repoName: string,
    branch: string,
    rootDir: string
  ) => {
    if (!user) return;
    setInspectingRepo(true);
    setInspectionNotice(null);
    try {
      const result = await githubService.inspectRepository(
        user.uid,
        owner,
        repoName,
        branch,
        rootDir
      );

      if (result.success) {
        setCandidateRootDirs(result.candidateRootDirectories || []);
        if (result.detectedFramework) {
          setFramework(result.detectedFramework);
        } else if (result.isStatic) {
          setFramework('static');
        }

        setBuildCommand(result.buildCommand !== null ? result.buildCommand : '');
        setOutputDirectory(result.outputDirectory !== null ? result.outputDirectory : '');
        if (result.installCommand) {
          setInstallCommand(result.installCommand);
        }

        if (result.isStatic) {
          setInspectionNotice({
            type: 'info',
            text: 'Static site detected',
            details: 'Repository contains HTML/CSS/JS without a build step. Deploys directly to global CDN.',
          });
        } else {
          setInspectionNotice({
            type: 'success',
            text: `Detected ${result.frameworkName} (${result.packageManager})`,
            details: result.hasPackageJson
              ? `Verified package.json in ${rootDir || 'repository root'}`
              : undefined,
          });
        }
      } else if (result.error) {
        setInspectionNotice({
          type: 'warning',
          text: result.error,
          details: 'Please check the directory name or select one of the detected folders below.',
        });
      }
    } catch (e: any) {
      console.warn('Repository inspection notice:', e);
    } finally {
      setInspectingRepo(false);
    }
  };

  const handleSelectRepo = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setProjectName(repo.name);
    setRootDirectory('');
    setCandidateRootDirs([]);
    setInspectionNotice(null);

    if (user) {
      setLoadingBranches(true);
      const branchToUse = repo.default_branch || 'main';
      setSelectedBranch(branchToUse);

      try {
        const bList = await githubService.getBranches(user.uid, repo.owner.login, repo.name);
        setBranches(bList);
        if (bList.length > 0 && !bList.some((b) => b.name === branchToUse)) {
          setSelectedBranch(bList[0].name);
        }
      } catch (err) {
        console.warn('Branch fetch notice:', err);
      } finally {
        setLoadingBranches(false);
      }

      // Automatically inspect the repository source, framework, and package.json
      await runInspection(repo.owner.login, repo.name, branchToUse, '');
    }
  };

  const handleBranchChange = async (newBranch: string) => {
    setSelectedBranch(newBranch);
    if (selectedRepo) {
      await runInspection(selectedRepo.owner.login, selectedRepo.name, newBranch, rootDirectory);
    }
  };

  const handleRootDirChange = async (newRootDir: string) => {
    setRootDirectory(newRootDir);
    if (selectedRepo) {
      await runInspection(selectedRepo.owner.login, selectedRepo.name, selectedBranch, newRootDir);
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

    if (!projectName.trim()) {
      setErrorMsg('Please enter a valid project name.');
      return;
    }

    setErrorMsg(null);
    setDeploying(true);

    try {
      // Check entitlement before initiating deployment
      const entitlement = await planService.canCreateProject(user.uid);
      if (!entitlement.allowed) {
        setErrorMsg(entitlement.reason || 'Active paid subscription required to deploy projects.');
        setDeploying(false);
        return;
      }

      const envRecord: Record<string, string> = {};
      envVars.forEach((v) => {
        if (v.key.trim()) envRecord[v.key.trim()] = v.value;
      });

      const { project } = await projectService.createProject({
        userId: user.uid,
        name: projectName.trim(),
        repositoryId: String(selectedRepo.id),
        repositoryName: selectedRepo.name,
        repositoryOwner: selectedRepo.owner.login,
        repositoryUrl: selectedRepo.html_url,
        rootDirectory: rootDirectory.trim(),
        branch: selectedBranch,
        framework: framework === 'static' ? '' : framework,
        buildCommand: buildCommand.trim(),
        outputDirectory: outputDirectory.trim(),
        installCommand: installCommand.trim(),
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
            Deploy full-stack applications with automated CI/CD and custom domain edge routing.
          </p>
        </div>
      </div>

      {/* Subscription Required Banner */}
      {hasActiveSub === false && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-700">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Paid Plan Required</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                  Payment Required
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Hosting and project deployments require an active paid subscription plan. Activate a plan to deploy.
              </p>
            </div>
          </div>
          <button
            id="newproject-activate-plan-banner-btn"
            onClick={() => navigate('/dashboard/billing')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap cursor-pointer"
          >
            Activate a Plan
          </button>
        </div>
      )}

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
                onChange={(e) => handleBranchChange(e.target.value)}
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

          {/* Root Directory (Monorepo Support) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
                Root Directory
                <span className="text-[11px] font-normal text-slate-500">(Monorepo support)</span>
              </label>
              {inspectingRepo && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Inspecting repository...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">./</span>
              <input
                id="input-root-directory"
                type="text"
                value={rootDirectory}
                placeholder="e.g. frontend or apps/web (leave blank for root)"
                onChange={(e) => setRootDirectory(e.target.value)}
                onBlur={(e) => handleRootDirChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRootDirChange((e.target as HTMLInputElement).value);
                  }
                }}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleRootDirChange(rootDirectory)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
              >
                Scan
              </button>
            </div>

            {candidateRootDirs.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-slate-500">Detected project folders:</span>
                {candidateRootDirs.map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => handleRootDirChange(dir)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
                      rootDirectory === dir
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
                    }`}
                  >
                    {dir}
                  </button>
                ))}
              </div>
            )}

            {/* Inspection result banner */}
            {inspectionNotice && (
              <div
                className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                  inspectionNotice.type === 'success'
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : inspectionNotice.type === 'warning'
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
                }`}
              >
                {inspectionNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : inspectionNotice.type === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{inspectionNotice.text}</p>
                  {inspectionNotice.details && (
                    <p className="text-[11px] opacity-80 mt-0.5">{inspectionNotice.details}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Custom Domain Workflow notice */}
          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
            <Globe className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-slate-900">Custom Domain Workflow</p>
              <p className="text-slate-600 leading-relaxed">
                Your project will be deployed to Vercel's global edge network with an initial deployment preview URL. Once deployment is <strong>READY</strong>, you can connect your own custom domain (e.g. <span className="font-mono font-medium text-indigo-700">yourbrand.com</span> or <span className="font-mono font-medium text-indigo-700">app.yourbrand.com</span>) in your project settings with instant DNS verification.
              </p>
            </div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Build Command
              </label>
              <input
                type="text"
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                placeholder="npm run build (or leave empty)"
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
                placeholder="dist (or leave empty for static)"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Install Command
              </label>
              <input
                type="text"
                value={installCommand}
                onChange={(e) => setInstallCommand(e.target.value)}
                placeholder="npm install"
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
