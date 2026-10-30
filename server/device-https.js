const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PASSPHRASE = 'siyabonga-local';
const httpsPort = Number(process.env.HTTPS_PORT || 8781);

function lanAddresses() {
  const ips = ['127.0.0.1'];
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach(function (name) {
    (nets[name] || []).forEach(function (net) {
      const v4 = net.family === 'IPv4' || net.family === 4;
      if (!v4 || net.internal) return;
      if (String(net.address).indexOf('169.254.') === 0) return;
      if (ips.indexOf(net.address) === -1) ips.push(net.address);
    });
  });
  return ips;
}

function ensureCert(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const ips = lanAddresses();
  const stamp = ips.join(',');
  const stampFile = path.join(dir, 'hosts.txt');
  const pfx = path.join(dir, 'shop.pfx');
  if (fs.existsSync(pfx) && fs.existsSync(stampFile) && fs.readFileSync(stampFile, 'utf8') === stamp) {
    return { pfx: pfx, passphrase: PASSPHRASE, ips: ips };
  }
  const script = path.join(rootOf(), 'scripts', 'make-phone-cert.ps1');
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], { stdio: 'inherit' });
  if (!fs.existsSync(pfx)) throw new Error('Phone certificate was not written.');
  return { pfx: pfx, passphrase: PASSPHRASE, ips: ips };
}

function rootOf() {
  return path.join(__dirname, '..');
}

module.exports = { ensureCert, lanAddresses, httpsPort };
