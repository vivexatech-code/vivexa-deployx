# Vivexa Hosting Platform

Vivexa Hosting is a production-grade cloud platform for deploying full-stack web applications with automated GitHub CI/CD, Vercel infrastructure integration, custom domain management with SSL, and GST-compliant subscription billing via Razorpay.

---

## Direct GitHub OAuth Setup Guide (For Platform Administrators)

Vivexa uses GitHub's official OAuth authorization flow (like Vercel, Netlify, and Render). Users simply click **Connect GitHub** and approve access. No user is ever asked to create, copy, or paste a GitHub Personal Access Token (PAT).

### 1. Register a GitHub OAuth App

1. Navigate to your GitHub Developer Settings:
   - [github.com/settings/developers](https://github.com/settings/developers) &rarr; **OAuth Apps** &rarr; **New OAuth App**
2. Fill in the application registration details:
   - **Application Name**: `Vivexa Hosting`
   - **Homepage URL**: `https://ais-dev-qypshwrdxrmbx4nzaztbxn-567282406906.asia-southeast1.run.app` (or your production domain `https://vivexatech.in`)
   - **Application Description**: `Cloud hosting and automated deployment platform by Vivexa`
   - **Authorization Callback URL**:
     ```
     https://ais-dev-qypshwrdxrmbx4nzaztbxn-567282406906.asia-southeast1.run.app/api/github/callback
     ```
     *(For production, also add or configure: `https://<your-custom-domain>/api/github/callback`)*
3. Click **Register Application**.

### 2. Generate Client Secret

1. Under the newly created OAuth App settings, locate your **Client ID**.
2. Click **Generate a new client secret**.
3. Copy both the **Client ID** and **Client Secret**.

### 3. Configure Server Environment Variables

Add the credentials to your environment variables (in AI Studio Settings &rarr; Secrets or `.env` file):

```env
# GitHub OAuth Integration (Server-Side Secrets)
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"
GITHUB_OAUTH_CALLBACK_URL="https://ais-dev-qypshwrdxrmbx4nzaztbxn-567282406906.asia-southeast1.run.app/api/github/callback"
```

> **Security Guarantee**: `GITHUB_CLIENT_SECRET` and user access tokens are kept exclusively in server-side memory and secure backend storage. They are never sent to browser JavaScript or stored in public client-readable Firestore documents.

### 4. Required Scopes & Permissions

Vivexa requests the following standard OAuth scopes:
- `repo`: Required to inspect repository lists, branches, and read repository configuration files (`package.json`) for automated framework preset detection.
- `read:user`: Required to retrieve the authenticated user's GitHub username and avatar.
- `user:email`: Required to identify the developer's primary email address.

### 5. Testing the Integration

1. Log into Vivexa as any user.
2. Navigate to **Dashboard &rarr; Projects &rarr; Import Git Repository**.
3. Click **Connect GitHub**.
4. GitHub will display the official **"Authorize Vivexa Hosting"** screen.
5. Once approved, the popup safely closes and your personal repositories (public and private) automatically appear in the repository selector.
6. Select a repository, choose the deployment branch, review framework settings, and click **Deploy Project**.

---

## Production Build & Start

```bash
# Development (starts Express server with Vite middleware on port 3000)
npm run dev

# Production Build
npm run build

# Start Production Server
npm run start
```
