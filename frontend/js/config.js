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

// Keep UI/navigation enhancements separate from the transfer logic.
(function () {
  var script = document.createElement('script');
  script.src = '/js/site-enhancements.js';
  script.defer = true;
  document.head.appendChild(script);
})();