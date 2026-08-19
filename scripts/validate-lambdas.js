const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..', 'backend', 'functions');
const dirs = fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory());
if (!dirs.length) throw new Error('No Lambda source directories found.');

let failed = false;
for (const dir of dirs) {
  const file = path.join(root, dir.name, 'index.js');
  if (!fs.existsSync(file)) continue;
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    console.log(`OK: ${path.relative(process.cwd(), file)}`);
  } catch {
    failed = true;
  }
}
if (failed) process.exit(1);
