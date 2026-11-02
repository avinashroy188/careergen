const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
  '.framercms': 'application/json'
};

function resolveFilePath(reqPath) {
  // Strip query string and decode
  let cleanPath = decodeURIComponent(reqPath.split('?')[0]);
  if (cleanPath.startsWith('/')) cleanPath = cleanPath.slice(1);
  if (!cleanPath || cleanPath === '') cleanPath = 'index.html';

  // 1. Direct match with .html first for clean URLs
  if (fs.existsSync(path.join(ROOT, cleanPath + '.html')) && fs.statSync(path.join(ROOT, cleanPath + '.html')).isFile()) {
    return path.join(ROOT, cleanPath + '.html');
  }

  // 2. Direct match
  let target = path.join(ROOT, cleanPath);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    return target;
  }

  // 3. If directory, check directory/index.html
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    const dirIndexHtml = path.join(target, 'index.html');
    if (fs.existsSync(dirIndexHtml)) return dirIndexHtml;
  }

  // 4. Try stripping trailing slash
  if (cleanPath.endsWith('/')) {
    const trimmed = cleanPath.slice(0, -1);
    return resolveFilePath('/' + trimmed);
  }

  return null;
}

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const filePath = resolveFilePath(req.url);

  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  let contentType = MIME_TYPES[ext];

  // If no extension, check if it's an HTML file or something else
  if (!contentType) {
    // Read first few bytes to check if it's HTML
    try {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(100);
      fs.readSync(fd, buffer, 0, 100, 0);
      fs.closeSync(fd);
      const start = buffer.toString('utf-8').trim();
      if (start.startsWith('<!doctype') || start.startsWith('<html') || start.includes('<!-- Made in Framer')) {
        contentType = 'text/html; charset=utf-8';
      } else {
        contentType = 'application/octet-stream';
      }
    } catch (e) {
      contentType = 'application/octet-stream';
    }
  }

  const stat = fs.statSync(filePath);
  const total = stat.size;

  // Handle Range requests (essential for PDFs and media)
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const partialstart = parts[0];
    const partialend = parts[1];

    const start = parseInt(partialstart, 10);
    const end = partialend ? parseInt(partialend, 10) : total - 1;
    const chunksize = (end - start) + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType
    });

    const fileStream = fs.createReadStream(filePath, { start, end });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': total,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`CareerGen server running at http://localhost:${PORT}/`);
  });
}

module.exports = server;
