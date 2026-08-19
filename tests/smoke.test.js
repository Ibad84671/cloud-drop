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

const allTextFiles = walk(root).filter(file => !file.includes(`${path.sep}.git${path.sep}`) && /\.(js|html|css|yaml|yml|md|json|sh|bat)$/.test(file));
for (const file of allTextFiles) {
  const content = fs.readFileSync(file, 'utf8');
  assert(!/^(<<<<<<<|=======|>>>>>>>)\s*$/m.test(content), `merge-conflict marker found in ${path.relative(root, file)}`);
}

const index = read('frontend/index.html');
assert(index.includes('/js/config.js'), 'frontend config must be loaded by the upload page');
assert(index.includes('/batch'), 'upload page must use the batch transfer API');
assert(index.includes('navigator.clipboard'), 'upload page must support link copying');

const transfer = read('frontend/t.html');
assert(transfer.includes('/js/config.js'), 'transfer page must use environment configuration');
assert(transfer.includes('/transfer/'), 'transfer page must resolve transfer metadata');

const workflow = read('.github/workflows/deploy.yml');
assert(workflow.includes('id-token: write'), 'deployment should use GitHub OIDC');
assert(workflow.includes('AWS_DEPLOY_ROLE_ARN'), 'deployment role must be explicit');
assert(!workflow.includes('AWS_ACCESS_KEY_ID'), 'workflow must not use long-lived AWS access keys');

console.log(`Smoke checks passed for ${sourceFiles.length} JavaScript source files.`);
