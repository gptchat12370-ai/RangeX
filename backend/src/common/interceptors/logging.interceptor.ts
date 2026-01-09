import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { appendFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
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
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request & { user?: any }>();
    const { method, url } = req as any;
    const userObj = (req as any).user;
    const user = userObj?.email || 'anonymous';
    const roles = userObj
      ? ['roleAdmin', 'roleCreator', 'roleSolver']
          .filter((r) => userObj[r])
          .map((r) => r.replace('role', '').toLowerCase())
          .join('|')
      : 'none';
    const authState = (req as any).headers?.authorization ? 'auth=present' : 'auth=none';
    const bodyPreview = (() => {
      try {
        const json = typeof (req as any).body === 'object' ? JSON.stringify((req as any).body) : String((req as any).body);
        return json.length > 500 ? json.slice(0, 500) + '…' : json;
      } catch {
        return 'unserializable-body';
      }
    })();
    const queryPreview = (() => {
      try {
        const json = JSON.stringify((req as any).query || {});
        return json.length > 300 ? json.slice(0, 300) + '…' : json;
      } catch {
        return 'unserializable-query';
      }
    })();

    ensureLogDir();
    rotateOldLogs();
    const logFile = currentLogFile();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = ctx.getResponse<any>();
          const duration = Date.now() - now;
          const line = `[${new Date().toISOString()}] ${method} ${url} ${res?.statusCode ?? '?'} user=${user} roles=${roles} ${authState} ${duration}ms query=${queryPreview} body=${bodyPreview}\n`;
          try {
            appendFileSync(logFile, line);
          } catch {
            // ignore logging errors
          }
        },
        error: (err) => {
          const res = ctx.getResponse<any>();
          const duration = Date.now() - now;
          const line = `[${new Date().toISOString()}] ${method} ${url} ${res?.statusCode ?? '?'} user=${user} roles=${roles} ${authState} ${duration}ms ERROR=${err?.message}\n`;
          try {
            appendFileSync(logFile, line);
          } catch {
            // ignore logging errors
          }
        },
      }),
    );
  }
}
