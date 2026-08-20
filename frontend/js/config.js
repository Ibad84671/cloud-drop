window.CloudDropConfig = {
  API_BASE: 'https://cskjg8lwvd.execute-api.us-east-1.amazonaws.com/dev',
  COGNITO_DOMAIN: 'clouddrop-502263855269-dev.auth.us-east-1.amazoncognito.com',
  COGNITO_CLIENT_ID: '70dc2rvh0bsrh40pskeilnhefd',
  TRANSFER_DAYS: 7
};

// Backward-compatible shape used by the existing authenticated pages.
window.CLOUDDROP_CONFIG = {
  apiBase: window.CloudDropConfig.API_BASE,
  region: 'us-east-1',
  cognitoClientId: window.CloudDropConfig.COGNITO_CLIENT_ID,
  cognitoUserPoolId: 'us-east-1_uynMtSJIy',
  cognitoDomain: window.CloudDropConfig.COGNITO_DOMAIN,
  transferDays: window.CloudDropConfig.TRANSFER_DAYS,
  emailEnabled: false
};
