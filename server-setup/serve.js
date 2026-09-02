// LAB — transfer server over the direct link. Serves any file in this folder.
const http = require('http');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

http.createServer((req, res) => {
  const who = req.socket.remoteAddress;
  const url = decodeURIComponent(req.url.split('?')[0]);
  console.log(new Date().toISOString(), who, req.method, url);
  if (url === '/') {
    const files = fs.readdirSync(DIR).filter(f => !f.startsWith('.') && f !== 'serve.log');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<h2>LAB transfer</h2>' + files.map(f => `<div><a href="/${f}">${f}</a></div>`).join(''));
  }
  const name = path.basename(url);            // strip any path traversal
  const p = path.join(DIR, name);
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) { res.writeHead(404); return res.end('not found'); }
  const size = fs.statSync(p).size;
  const isText = /\.(bat|ps1|txt|cfg|sh)$/i.test(name);
  res.writeHead(200, {
    'Content-Type': isText ? 'text/plain; charset=utf-8' : 'application/octet-stream',
    'Content-Length': size,
    'Content-Disposition': `attachment; filename="${name}"`
  });
  fs.createReadStream(p).pipe(res);
}).listen(8000, '0.0.0.0', () => console.log(`serving ${DIR} on 0.0.0.0:8000`));
