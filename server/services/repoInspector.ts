import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { tokenStore } from '../tokenStore';

export interface RepoInspectionResult {
  success: boolean;
  detectedFramework: string | null;
  frameworkName: string;
  buildCommand: string | null;
  outputDirectory: string | null;
  installCommand: string | null;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  hasPackageJson: boolean;
  isStatic: boolean;
  rootDirectory: string;
  rootDirectoryValid: boolean;
  candidateRootDirectories: string[];
  availableScripts: string[];
  error?: string;
}

export class RepoInspector {
  /**
   * Inspect a GitHub repository archive for framework, package.json,
   * build commands, package managers, and monorepo structure.
   */
  public static async inspectRepository(params: {
    owner: string;
    repo: string;
    branch?: string;
    rootDirectory?: string;
    userId?: string;
    token?: string;
  }): Promise<RepoInspectionResult> {
    const { owner, repo, branch = 'main' } = params;
    const cleanRootDir = (params.rootDirectory || '').replace(/^\/+|\/+$/g, '').trim();

    let githubToken = params.token;
    if (!githubToken && params.userId) {
      const stored = tokenStore.getToken(params.userId);
      if (stored && stored.token && stored.token !== 'demo_simulated_token') {
        githubToken = stored.token;
      }
    }

    const tmpDir = path.join('/tmp', `inspect_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      // 1. Download tarball from GitHub
      const headers: Record<string, string> = {
        'User-Agent': 'Vivexa-Hosting-Platform',
      };
      if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`;
      }

      const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${encodeURIComponent(branch)}`;
      const res = await fetch(tarballUrl, { headers });

      if (!res.ok) {
        // If branch failed, try without branch (default branch)
        if (res.status === 404 && branch !== 'master' && branch !== 'main') {
          const fallbackRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/tarball`, { headers });
          if (!fallbackRes.ok) {
            return this.getDefaultResult(cleanRootDir, `Failed to fetch repository from GitHub: HTTP ${res.status}`);
          }
          const buffer = await fallbackRes.arrayBuffer();
          fs.writeFileSync(path.join(tmpDir, 'repo.tar.gz'), Buffer.from(buffer));
        } else {
          return this.getDefaultResult(cleanRootDir, `Failed to fetch repository from GitHub: HTTP ${res.status}`);
        }
      } else {
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(path.join(tmpDir, 'repo.tar.gz'), Buffer.from(buffer));
      }

      // 2. Extract tarball
      const extractDir = path.join(tmpDir, 'extracted');
      fs.mkdirSync(extractDir, { recursive: true });
      execSync(`tar -xzf "${path.join(tmpDir, 'repo.tar.gz')}" -C "${extractDir}" --strip-components=1`);

      // 3. Discover candidate root directories with package.json
      const candidateRootDirectories: string[] = [];
      const searchForPackageJsons = (dir: string, base: string, depth = 0) => {
        if (depth > 2) return;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.next') continue;
            if (entry.isDirectory()) {
              const fullSub = path.join(dir, entry.name);
              const relSub = path.relative(base, fullSub).replace(/\\/g, '/');
              if (fs.existsSync(path.join(fullSub, 'package.json'))) {
                candidateRootDirectories.push(relSub);
              }
              searchForPackageJsons(fullSub, base, depth + 1);
            }
          }
        } catch {
          // ignore
        }
      };
      searchForPackageJsons(extractDir, extractDir);

      // 4. Resolve target root directory
      const targetDir = cleanRootDir ? path.join(extractDir, cleanRootDir) : extractDir;
      const rootDirectoryValid = fs.existsSync(targetDir);

      if (!rootDirectoryValid) {
        return {
          success: false,
          detectedFramework: 'vite',
          frameworkName: 'Vite',
          buildCommand: 'npm run build',
          outputDirectory: 'dist',
          installCommand: 'npm install',
          packageManager: 'npm',
          hasPackageJson: false,
          isStatic: false,
          rootDirectory: cleanRootDir,
          rootDirectoryValid: false,
          candidateRootDirectories,
          availableScripts: [],
          error: `Root directory "${cleanRootDir}" does not exist in repository.`,
        };
      }

      // 5. Detect Package Manager
      let packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' = 'npm';
      if (fs.existsSync(path.join(targetDir, 'bun.lockb')) || fs.existsSync(path.join(targetDir, 'bun.lock')) || fs.existsSync(path.join(extractDir, 'bun.lockb'))) {
        packageManager = 'bun';
      } else if (fs.existsSync(path.join(targetDir, 'pnpm-lock.yaml')) || fs.existsSync(path.join(extractDir, 'pnpm-lock.yaml'))) {
        packageManager = 'pnpm';
      } else if (fs.existsSync(path.join(targetDir, 'yarn.lock')) || fs.existsSync(path.join(extractDir, 'yarn.lock'))) {
        packageManager = 'yarn';
      } else {
        packageManager = 'npm';
      }

      const runPrefix = packageManager === 'yarn' ? 'yarn' : `${packageManager} run`;
      const installCommand = `${packageManager} install`;

      // 6. Inspect package.json
      const pkgPath = path.join(targetDir, 'package.json');
      let hasPackageJson = false;
      let availableScripts: string[] = [];
      let detectedFramework: string | null = null;
      let frameworkName = 'Other';
      let buildCommand: string | null = `${runPrefix} build`;
      let outputDirectory: string | null = 'dist';
      let isStatic = false;

      if (fs.existsSync(pkgPath)) {
        hasPackageJson = true;
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
          const scripts = pkg.scripts || {};
          availableScripts = Object.keys(scripts);

          // Detect Framework
          if (deps['next']) {
            detectedFramework = 'nextjs';
            frameworkName = 'Next.js';
            buildCommand = scripts.build ? `${runPrefix} build` : null;
            outputDirectory = '.next';
          } else if (deps['vite']) {
            detectedFramework = 'vite';
            frameworkName = 'Vite';
            buildCommand = scripts.build ? `${runPrefix} build` : null;
            outputDirectory = 'dist';
          } else if (deps['@remix-run/react'] || deps['@remix-run/node']) {
            detectedFramework = 'remix';
            frameworkName = 'Remix';
            buildCommand = scripts.build ? `${runPrefix} build` : null;
            outputDirectory = 'build';
          } else if (deps['astro']) {
            detectedFramework = 'astro';
            frameworkName = 'Astro';
            buildCommand = scripts.build ? `${runPrefix} build` : null;
            outputDirectory = 'dist';
          } else if (deps['@sveltejs/kit'] || deps['svelte']) {
            detectedFramework = 'svelte';
            frameworkName = 'Svelte';
            buildCommand = scripts.build ? `${runPrefix} build` : null;
            outputDirectory = 'dist';
          } else if (deps['nuxt'] || deps['nuxt3']) {
            detectedFramework = 'nuxtjs';
            frameworkName = 'Nuxt';
            buildCommand = scripts.build ? `${runPrefix} build` : null;
            outputDirectory = '.output/public';
          } else if (deps['gatsby']) {
            detectedFramework = 'gatsby';
            frameworkName = 'Gatsby';
            buildCommand = scripts.build ? `${runPrefix} build` : null;
            outputDirectory = 'public';
          } else if (deps['react-scripts']) {
            detectedFramework = 'create-react-app';
            frameworkName = 'Create React App';
            buildCommand = scripts.build ? `${runPrefix} build` : null;
            outputDirectory = 'build';
          } else if (deps['@angular/core']) {
            detectedFramework = 'angular';
            frameworkName = 'Angular';
            buildCommand = scripts.build ? `${runPrefix} build` : null;
            outputDirectory = 'dist';
          } else if (scripts.build) {
            detectedFramework = 'other';
            frameworkName = 'Node.js Build';
            buildCommand = `${runPrefix} build`;
            outputDirectory = 'dist';
          } else {
            // package.json exists but NO build script and no framework
            // Check if HTML files exist -> Static site!
            const hasHtml = fs.existsSync(path.join(targetDir, 'index.html')) || fs.existsSync(path.join(targetDir, 'public', 'index.html'));
            if (hasHtml) {
              detectedFramework = null;
              frameworkName = 'Static HTML / Jamstack';
              buildCommand = null;
              outputDirectory = null;
              isStatic = true;
            } else {
              detectedFramework = null;
              frameworkName = 'Other';
              buildCommand = null;
              outputDirectory = null;
            }
          }
        } catch (parseErr) {
          console.warn('Failed to parse package.json:', parseErr);
        }
      } else {
        // No package.json at all!
        const hasHtml = fs.existsSync(path.join(targetDir, 'index.html')) || fs.existsSync(path.join(targetDir, 'public', 'index.html'));
        detectedFramework = null;
        frameworkName = hasHtml ? 'Static HTML / Jamstack' : 'Static / Other';
        buildCommand = null;
        outputDirectory = null;
        isStatic = true;
      }

      return {
        success: true,
        detectedFramework,
        frameworkName,
        buildCommand,
        outputDirectory,
        installCommand: hasPackageJson ? installCommand : null,
        packageManager,
        hasPackageJson,
        isStatic,
        rootDirectory: cleanRootDir,
        rootDirectoryValid: true,
        candidateRootDirectories,
        availableScripts,
      };
    } catch (err: any) {
      console.error('Error during repository inspection:', err);
      return this.getDefaultResult(cleanRootDir, err.message);
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }

  private static getDefaultResult(cleanRootDir: string, error?: string): RepoInspectionResult {
    return {
      success: false,
      detectedFramework: 'vite',
      frameworkName: 'Vite',
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
      installCommand: 'npm install',
      packageManager: 'npm',
      hasPackageJson: false,
      isStatic: false,
      rootDirectory: cleanRootDir,
      rootDirectoryValid: true,
      candidateRootDirectories: [],
      availableScripts: [],
      error,
    };
  }
}
