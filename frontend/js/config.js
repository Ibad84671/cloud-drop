window.CloudDropConfig = {
  API_BASE: 'https://cskjg8lwvd.execute-api.us-east-1.amazonaws.com/dev',
  COGNITO_DOMAIN: 'clouddrop-502263855269-dev.auth.us-east-1.amazoncognito.com',
  COGNITO_CLIENT_ID: '70dc2rvh0bsrh40pskeilnhefd',
  TRANSFER_DAYS: 7
};

window.CLOUDDROP_CONFIG = {
  apiBase: window.CloudDropConfig.API_BASE,
  region: 'us-east-1',
  cognitoClientId: window.CloudDropConfig.COGNITO_CLIENT_ID,
  cognitoUserPoolId: 'us-east-1_uynMtSJIy',
  cognitoDomain: window.CloudDropConfig.COGNITO_DOMAIN,
  transferDays: window.CloudDropConfig.TRANSFER_DAYS,
  emailEnabled: false
};

// Frontend-only UI hardening. This runs before index.html's main script and
// remains compatible with deploy.sh, which regenerates this file at deploy time.
(function () {
  function install() {
    var root = document.documentElement;
    var style = document.getElementById('clouddrop-ui-fixes');
    if (!style) {
      style = document.createElement('style');
      style.id = 'clouddrop-ui-fixes';
      style.textContent = [
        '.wrap{width:min(1320px,calc(100% - 48px))}',
        '.main-grid{grid-template-columns:260px minmax(0,700px) 260px;column-gap:48px}',
        '@media(max-width:1040px){.wrap{width:min(100% - 40px,1320px)}.main-grid{column-gap:32px}}',
        '@media(max-width:760px){.wrap{width:calc(100% - 24px)}.main-grid{column-gap:0}}',
        '.theme-toggle{font-size:0}',
        '.theme-toggle::before{content:"☾";font-size:16px}',
        'html[data-theme="light"] .theme-toggle::before{content:"☀"}',
        '#emailInput::placeholder{color:transparent}',
        '.email-block{position:relative}',
        '.email-block:has(#emailInput)::before{content:"Recipient email";display:block;font-size:10px;color:var(--muted);margin:0 0 3px}',
        '.side-note{display:none}'
      ].join('');
      document.head.appendChild(style);
    }

    var themeButton = document.getElementById('themeToggle');
    if (themeButton && !themeButton.dataset.hardened) {
      themeButton.dataset.hardened = 'true';
      themeButton.addEventListener('click', function () {
        var next = root.dataset.theme === 'light' ? 'dark' : 'light';
        root.dataset.theme = next;
        try { localStorage.setItem('clouddrop-theme', next); } catch (_) {}
        themeButton.setAttribute('aria-label', next === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
