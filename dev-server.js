'use strict';
// Serveur local pour tester sans Vercel :  npm run dev  → http://localhost:3000
// (stockage en mémoire : les données disparaissent à l'arrêt)
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const handlers = {};
for (const f of fs.readdirSync(path.join(__dirname, 'api'))) {
  handlers['/api/' + f.replace('.js', '')] = require('./api/' + f);
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://local');
    if (handlers[url.pathname]) return handlers[url.pathname](req, res);
    let p = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!path.extname(p)) p += '.html';
    const file = path.join(__dirname, 'public', path.normalize(p));
    if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file)) {
      res.statusCode = 404;
      return res.end('Not found');
    }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
}

module.exports = { createServer };

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createServer().listen(port, () => console.log(`http://localhost:${port}  (écran de la salle : /resultats)`));
}
