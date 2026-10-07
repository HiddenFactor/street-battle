// =====================================================================
// tools/serve.js – Mini-Webserver ohne Abhängigkeiten
// ---------------------------------------------------------------------
// Browser laden JavaScript-Module (import/export) nicht direkt von der
// Festplatte (file://). Deshalb liefert dieser kleine Server die
// Spieldateien über http://localhost aus.
//
//   node tools/serve.js          Server starten
//   node tools/serve.js --open   Server starten und Browser öffnen
//
// Der Server ist auch im eigenen WLAN erreichbar (z. B. fürs Handy).
// Die Adresse dafür wird beim Start angezeigt.
// =====================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIRST_PORT = Number(process.env.PORT) || 8080;
const OPEN_BROWSER = process.argv.includes('--open');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Ungültige Adresse');
  }
  // Versteckte Dateien/Ordner (z. B. .git) nie ausliefern
  if (urlPath.split('/').some((part) => part.startsWith('.'))) return send(res, 404, 'Nicht gefunden');
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const file = path.join(ROOT, urlPath);
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'Verboten');

  fs.stat(file, (err, stat) => {
    if (err) return send(res, 404, 'Nicht gefunden: ' + urlPath);
    if (stat.isDirectory()) {
      res.writeHead(301, { Location: urlPath + '/' });
      return res.end();
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      // Kein Zwischenspeichern: Änderungen an config.js wirken sofort nach dem Neuladen
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
});

function lanAddresses() {
  const result = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) result.push(a.address);
    }
  }
  return result;
}

function openBrowser(url) {
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"` :
    process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}

let port = FIRST_PORT;
let triesLeft = 10;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && triesLeft > 0) {
    console.log(`Port ${port} ist belegt, versuche ${port + 1} ...`);
    triesLeft--;
    port++;
    server.listen(port, '0.0.0.0');
  } else {
    console.error('Server konnte nicht starten:', err.message);
    process.exit(1);
  }
});

server.on('listening', () => {
  const url = `http://localhost:${port}/`;
  console.log('');
  console.log('  STREET BATTLE läuft!');
  console.log(`  Auf diesem PC:        ${url}`);
  for (const ip of lanAddresses()) console.log(`  Im WLAN (z. B. Handy): http://${ip}:${port}/`);
  console.log('');
  console.log('  Zum Beenden dieses Fenster schließen oder Strg+C drücken.');
  console.log('');
  if (OPEN_BROWSER) openBrowser(url);
});

server.listen(port, '0.0.0.0');
