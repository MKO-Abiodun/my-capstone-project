import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter } from './router.js';

const DEFAULT_PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));
const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8']
]);

export function createApp({ publicDir = DEFAULT_PUBLIC_DIR, router = createRouter() } = {}) {
  if (!router.match('GET', '/health')) {
    router.add('GET', '/health', (_request, response) => {
      sendJson(response, 200, { status: 'ok' });
    });
  }

  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, 'http://localhost');
      request.body = await readJsonBody(request);

      const matched = router.match(request.method, requestUrl.pathname);
      if (matched) {
        if (matched.handler.length <= 1) {
          const result = await matched.handler({ request, response, params: matched.params, body: request.body });
          if (result && typeof result === 'object' && 'status' in result && 'body' in result) {
            sendJson(response, result.status, result.body);
          } else if (result !== undefined) {
            sendJson(response, 200, result);
          }
          return;
        }

        await matched.handler(request, response, matched.params);
        return;
      }

      if (requestUrl.pathname === '/health' && request.method !== 'GET') {
        sendError(response, 404, 'NOT_FOUND', 'Route not found');
        return;
      }

      if (requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/')) {
        sendError(response, 404, 'NOT_FOUND', 'Route not found');
        return;
      }

      if (request.method === 'GET' || request.method === 'HEAD') {
        await serveStaticFile(requestUrl.pathname, publicDir, response, request.method === 'HEAD');
        return;
      }

      sendError(response, 404, 'NOT_FOUND', 'Route not found');
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }

      if (error instanceof HttpError) {
        sendError(response, error.status, error.code, error.message);
        return;
      }

      if (error instanceof URIError) {
        sendError(response, 400, 'BAD_REQUEST', 'Invalid URL encoding');
        return;
      }

      if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
        sendError(response, mapDomainErrorStatus(error.code), error.code, error.message || 'Request failed');
        return;
      }

      sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
    }
  });
}

function mapDomainErrorStatus(code) {
  switch (code) {
    case 'VALIDATION':
    case 'PAYMENT_DECLINED':
    case 'INVALID_TRANSITION':
    case 'INVALID_STATE':
    case 'SOLD_OUT':
      return 400;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    default:
      return 500;
  }
}

async function readJsonBody(request) {
  const contentType = request.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('application/json')) return undefined;

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return undefined;

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', 'Invalid JSON body');
  }
}

async function serveStaticFile(urlPath, publicDir, response, headOnly) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', 'Invalid URL encoding');
  }

  if (decodedPath.includes('\0')) {
    throw new HttpError(400, 'BAD_REQUEST', 'Invalid file path');
  }

  const root = await realpath(path.resolve(publicDir));
  let target = path.resolve(root, `.${decodedPath}`);
  if (!isWithinDirectory(root, target)) {
    throw new HttpError(404, 'NOT_FOUND', 'File not found');
  }

  let targetStats;
  try {
    target = await realpath(target);
    if (!isWithinDirectory(root, target)) {
      throw new HttpError(404, 'NOT_FOUND', 'File not found');
    }
    targetStats = await stat(target);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      throw new HttpError(404, 'NOT_FOUND', 'File not found');
    }
    throw error;
  }

  if (targetStats.isDirectory()) {
    target = path.join(target, 'index.html');
    try {
      target = await realpath(target);
      if (!isWithinDirectory(root, target)) {
        throw new HttpError(404, 'NOT_FOUND', 'File not found');
      }
      targetStats = await stat(target);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        throw new HttpError(404, 'NOT_FOUND', 'File not found');
      }
      throw error;
    }
  }

  if (!targetStats.isFile()) {
    throw new HttpError(404, 'NOT_FOUND', 'File not found');
  }

  const body = await readFile(target);
  response.writeHead(200, {
    'Content-Type': MIME_TYPES.get(path.extname(target).toLowerCase()) || 'application/octet-stream',
    'Content-Length': body.length
  });
  response.end(headOnly ? undefined : body);
}

function isWithinDirectory(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) &&
    relative !== '..' && !path.isAbsolute(relative));
}

function sendJson(response, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length
  });
  response.end(body);
}

function sendError(response, status, code, message) {
  sendJson(response, status, { error: { code, message } });
}

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
