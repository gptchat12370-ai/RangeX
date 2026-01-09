import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { appendFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

const LOG_DIR = join(process.cwd(), 'logs');
const LOG_TTL_DAYS = 7;

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function currentLogFile() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return join(LOG_DIR, `app-${yyyy}-${mm}-${dd}.log`);
}

function rotateOldLogs() {
  try {
    const cutoff = Date.now() - LOG_TTL_DAYS * 24 * 60 * 60 * 1000;
    for (const file of readdirSync(LOG_DIR)) {
      const full = join(LOG_DIR, file);
      const stats = statSync(full);
      if (stats.isFile() && stats.mtime.getTime() < cutoff) {
        unlinkSync(full);
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    ensureLogDir();
    const start = Date.now();
    const { method, originalUrl, body, query } = req;
    const userObj = (req as any).user;
    const user = userObj?.email || 'anonymous';
    const roles = userObj
      ? `roles=${['roleAdmin', 'roleCreator', 'roleSolver']
          .filter((r) => userObj[r])
          .map((r) => r.replace('role', '').toLowerCase())
          .join('|')}`
      : 'roles=none';
    const authState = req.headers.authorization ? 'auth=present' : 'auth=none';
    const bodyPreview = (() => {
      try {
        const json = typeof body === 'object' ? JSON.stringify(body) : String(body);
        return json.length > 500 ? json.slice(0, 500) + '…' : json;
      } catch {
        return 'unserializable-body';
      }
    })();
    const queryPreview = (() => {
      try {
        const json = JSON.stringify(query || {});
        return json.length > 300 ? json.slice(0, 300) + '…' : json;
      } catch {
        return 'unserializable-query';
      }
    })();

    res.on('finish', () => {
      const duration = Date.now() - start;
      ensureLogDir();
      rotateOldLogs();
      const logFile = currentLogFile();
      const logLine = `[${new Date().toISOString()}] ${method} ${originalUrl} ${res.statusCode} user=${user} ${roles} ${authState} ${duration}ms query=${queryPreview} body=${bodyPreview}\n`;
      try {
        appendFileSync(logFile, logLine);
      } catch (err) {
        // swallow logging errors
      }
    });

    next();
  }
}
