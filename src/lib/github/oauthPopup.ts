import { NextResponse } from 'next/server';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderOAuthPopup(options: {
  success: boolean;
  message: string;
  origin: string;
  payload: Record<string, unknown>;
}): NextResponse {
  const safeMessage = escapeHtml(options.message);
  const payloadJson = JSON.stringify(options.payload).replace(/</g, '\\u003c');
  const title = options.success ? 'GitHub Connected!' : 'Connection Failed';
  const headingColor = options.success ? '#10b981' : '#ef4444';
  const nextPath = options.success ? 'connected' : 'error';

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>GitHub Authorization</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0b0f19; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #111827; border: 1px solid #1f2937; padding: 2rem; border-radius: 0.75rem; text-align: center; max-width: 400px; }
    h2 { margin-top: 0; color: ${headingColor}; }
    p { color: #9ca3af; font-size: 0.875rem; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h2>${title}</h2>
    <p>${safeMessage}</p>
    <p>This window will close automatically...</p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage(${payloadJson}, ${JSON.stringify(options.origin)});
      }
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => {
      window.close();
      if (!window.closed) {
        window.location.href = ${JSON.stringify(`${options.origin}/dashboard/projects/new?github=${nextPath}`)};
      }
    }, 1200);
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: options.success ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
