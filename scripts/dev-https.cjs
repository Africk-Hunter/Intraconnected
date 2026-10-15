// HTTPS front for the local dev server, so a phone on the same Wi-Fi gets a
// secure context (Web Crypto needs one). Started automatically by
// `npm run dev:functions` (see dev-local.cjs); open
// https://<this PC's LAN IP>:8889 on the phone once that's running.
// The first run makes a self-signed certificate in .cert/ (gitignored); the
// phone must then trust it, or Safari keeps the page insecure and Web Crypto
// stays off: open https://<ip>:8889/dev-cert.crt on the iPhone, Allow, then
// Settings > General > VPN & Device Management > install the profile, and
// Settings > General > About > Certificate Trust Settings > turn it on.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');
const { execFileSync } = require('child_process');

const TARGET_PORT = Number(process.env.TARGET_PORT || 8888);
const LISTEN_PORT = Number(process.env.HTTPS_PORT || 8889);
const certDir = path.join(__dirname, '..', '.cert');
const keyFile = path.join(certDir, 'dev-key.pem');
const certFile = path.join(certDir, 'dev-cert.pem');

const lanIps = Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address);

const hostName = os.hostname();

if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
  fs.mkdirSync(certDir, { recursive: true });
  const san = ['DNS:localhost', `DNS:${hostName}.local`, 'IP:127.0.0.1', ...lanIps.map((ip) => `IP:${ip}`)].join(',');
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '365',
    '-keyout', keyFile, '-out', certFile,
    '-subj', '/CN=intraconnected-dev', '-addext', `subjectAltName=${san}`,
    '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,digitalSignature,keyEncipherment,keyCertSign',
    '-addext', 'extendedKeyUsage=serverAuth',
  ], { stdio: 'inherit' });
}

const server = https.createServer(
  { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) },
  (req, res) => {
    // The phone downloads this and installs it as trusted (see the note at the top).
    if (req.url === '/dev-cert.crt') {
      res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="intraconnected-dev.crt"' });
      res.end(fs.readFileSync(certFile));
      return;
    }
    const upstream = http.request(
      { host: '127.0.0.1', port: TARGET_PORT, path: req.url, method: req.method, headers: req.headers },
      (up) => {
        res.writeHead(up.statusCode, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('error', () => { res.statusCode = 502; res.end('Dev server on port ' + TARGET_PORT + ' is not running.'); });
    req.pipe(upstream);
  },
);

// Websockets (Vite hot reload)
server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(TARGET_PORT, '127.0.0.1', () => {
    const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`HTTPS proxy -> http://localhost:${TARGET_PORT}`);
  console.log(`  easier to remember: https://${hostName}.local:${LISTEN_PORT}`);
  for (const ip of lanIps) console.log(`  open on your phone: https://${ip}:${LISTEN_PORT}`);
});
