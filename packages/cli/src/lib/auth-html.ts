import type { ThemeColors } from "../theme";

const escapeHtml = (value?: string) =>
  (value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character as keyof typeof escapeHtml.map]!,
  );
escapeHtml.map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const getAuthHtml = (success: boolean, errorMsg?: string, theme?: ThemeColors) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wright CLI - Authentication</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: ${theme?.background || '#000000'};
      --card-bg: ${theme?.surface || '#111111'};
      --text-main: ${theme?.primary || '#FFFFFF'};
      --text-muted: ${theme?.info || '#888888'};
      --border-color: ${theme?.dimSeparator || '#222222'};
      --accent-color: ${theme?.primary || '#ffffff'};
      --success-color: ${theme?.success || '#10B981'};
      --error-color: ${theme?.error || '#EF4444'};
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'JetBrains Mono', monospace;
      background-color: var(--bg-color);
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 40px;
      max-width: 400px;
      width: 90%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeUp {
      0% { opacity: 0; transform: translateY(16px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .icon-success {
      background-color: rgba(16, 185, 129, 0.1);
      color: var(--success-color);
    }
    .icon-error {
      background-color: rgba(239, 68, 68, 0.1);
      color: var(--error-color);
    }
    .icon svg {
      width: 24px;
      height: 24px;
    }
    h1 {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 12px;
    }
    p {
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-muted);
      margin: 0 0 24px;
    }

  </style>
</head>
<body>
  <div class="container">
    <div class="icon ${success ? 'icon-success' : 'icon-error'}">
      ${success 
        ? '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>'
      }
    </div>
    <h1>${success ? 'Authentication Successful' : 'Authentication Failed'}</h1>
    <p>${success ? 'You have successfully authenticated with Wright CLI.<br/>You can safely close this tab and return to your terminal.' : escapeHtml(errorMsg)}</p>
  </div>
</body>
</html>`;
