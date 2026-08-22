const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const sourceFiles = walk(path.join(root, 'backend')).concat(walk(path.join(root, 'frontend'))).filter(file => file.endsWith('.js'));
for (const file of sourceFiles) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });

const htmlFiles = walk(path.join(root, 'frontend')).filter(file => file.endsWith('.html'));
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  assert(html.includes('<!doctype html>'), `missing doctype in ${path.relative(root, file)}`);
  assert(!/<script[^>]+src=["']https?:\/\//i.test(html), `remote script dependency found in ${path.relative(root, file)}`);
}

const allTextFiles = walk(root).filter(file => !file.includes(`${path.sep}.git${path.sep}`) && /\.(js|html|css|yaml|yml|md|json|sh|bat)$/.test(file));
for (const file of allTextFiles) {
  const content = fs.readFileSync(file, 'utf8');
  assert(!/^(<<<<<<<|=======|>>>>>>>)\s*$/m.test(content), `merge-conflict marker found in ${path.relative(root, file)}`);
}

const index = read('frontend/index.html');
assert(index.includes('/js/config.js'), 'upload page must load runtime configuration');
assert(index.includes("api('/batch'"), 'upload page must use the batch transfer API');
assert(index.includes('navigator.clipboard'), 'upload page must support link copying');
assert(index.includes('sessionStorage'), 'upload page must not persist auth tokens in localStorage');

const transferRuntime = read('frontend/js/transfer-runtime.js');
assert(transferRuntime.includes('completionToken'), 'upload runtime must retain the completion token');
assert(transferRuntime.includes("X-Completion-Token"), 'upload runtime must send the completion token header');

const batchCreate = read('backend/functions/batch-create/index.js');
assert(batchCreate.includes('const completionToken=crypto.randomUUID()'), 'batch-create must generate a completion token');
assert(batchCreate.includes('completionToken,createdAt'), 'batch-create must persist the completion token');
assert(batchCreate.includes('data:{transferId,completionToken'), 'batch-create must return the completion token to the creator');

const batchComplete = read('backend/functions/batch-complete/index.js');
assert(batchComplete.includes("header(e,'X-Completion-Token')"), 'batch-complete must read the completion token header');
assert(batchComplete.includes("'INVALID_COMPLETION_TOKEN'"), 'batch-complete must reject invalid completion tokens');
assert(batchComplete.includes('401'), 'batch-complete must return 401 for missing or invalid completion tokens');

const transfer = read('frontend/t.html');
assert(transfer.includes('/transfer/'), 'transfer page must resolve transfer metadata');
assert(transfer.includes('^[0-9a-f-]{36}$'), 'transfer page must validate transfer IDs');

const callback = read('frontend/auth-callback.html');
assert(callback.includes('code_verifier'), 'Cognito callback must use PKCE');
assert(callback.includes('/oauth2/token'), 'Cognito callback must exchange the authorization code');

const template = read('infrastructure/cfn/main.yaml');
assert(template.includes('UsernameAttributes: [email]'), 'Cognito must use email usernames');
assert(!template.includes('Required: true'), 'Cognito template must not declare required custom attributes');
assert(template.includes('COGNITO_USER_POOLS'), 'protected API methods must use Cognito authorization');
assert(template.includes('ThrottlingBurstLimit'), 'API Gateway stage should have abuse-resistant throttling');
assert(template.includes('X-Completion-Token'), 'API Gateway CORS must allow the completion token header');
assert(!template.includes('Action: "*"'), 'CloudFormation must not contain wildcard IAM actions');

const waf = read('infrastructure/cfn/waf.yaml');
assert(waf.includes('AWSManagedRulesCommonRuleSet'), 'API WAF must include AWS Common Rule Set');
assert(waf.includes('AWSManagedRulesKnownBadInputsRuleSet'), 'API WAF must include Known Bad Inputs Rule Set');
assert(waf.includes('AWS::WAFv2::WebACLAssociation'), 'API WAF must be associated with the API Gateway stage');

const workflow = read('.github/workflows/deploy.yml');
assert(workflow.includes('id-token: write'), 'deployment should use GitHub OIDC');
assert(workflow.includes('AWS_DEPLOY_ROLE_ARN'), 'deployment role must be explicit');
assert(workflow.includes('ARCHIVER_LAYER_ARN'), 'deployment must provide the ZIP archiver layer');
assert(!workflow.includes('AWS_ACCESS_KEY_ID'), 'workflow must not use long-lived AWS access keys');

for (const junk of ['current-stack-template.json', 'infrastructure/cfn/deployed-template.yaml', 'frontend-delete.json', 'test-upload.txt']) {
  assert(!fs.existsSync(path.join(root, junk)), `generated artifact still tracked/present: ${junk}`);
}

console.log(`Smoke checks passed for ${sourceFiles.length} JavaScript source files and ${htmlFiles.length} HTML pages.`);
