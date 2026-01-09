import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../services/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, body } = request;

    // Don't log audit logs endpoints
    if (url.includes('/admin/audit-logs')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        if (method !== 'GET') {
          // Normalize URL by replacing UUIDs with :id to keep actionType concise
          const normalizedUrl = url.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
          
          this.auditService.log({
            userId: user?.sub,
            actionType: `${method} ${normalizedUrl}`,
            details: { body },
            req: request,
          });
        }
      }),
    );
  }
}
