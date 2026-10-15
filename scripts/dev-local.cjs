// One command for local dev: `netlify dev` (app + Functions, netlify.toml
// headers), an ngrok tunnel to it, and an HTTPS proxy for a phone on the LAN
// - all together, so there's no separate ngrok/https/phone script to remember.
//
// Personal ngrok settings stay out of the repo: put them in .ngrok.local.json
// (gitignored) as { "path": "...\\ngrok.exe", "url": "your-name.ngrok-free.dev" }
// or set NGROK_PATH / NGROK_URL. Both are optional - without them this still
// starts netlify dev and the HTTPS proxy, it just skips the tunnel attempt if
// no `ngrok` binary is on PATH either.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let local = {};
try {
  local = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.ngrok.local.json'), 'utf8'));
} catch {
  // no local file: fall back to env vars / defaults
}

const ngrokPath = process.env.NGROK_PATH || local.path || 'ngrok';
const ngrokUrl = process.env.NGROK_URL || local.url;
const port = String(process.env.TARGET_PORT || 8888);

const run = (command, args) => {
  const child = spawn(command, args, { stdio: 'inherit', shell: true });
  child.on('exit', (code) => process.exit(code || 0));
  return child;
};

run('npx', ['netlify', 'dev']);
run(`"${ngrokPath}"`, ['http', ...(ngrokUrl ? [`--url=${ngrokUrl}`] : []), port]);

// Same process, not a subprocess - it just starts listening.
require('./dev-https.cjs');
