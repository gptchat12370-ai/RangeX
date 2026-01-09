import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AppRole } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Missing user context');
    }

    // Hierarchical roles:
    // - Admin implies creator and solver
    // - Creator implies solver
    // - Solver is solver only
    const userRoles: AppRole[] = [];
    if (user.roleAdmin) {
      userRoles.push('admin', 'creator', 'solver');
    } else if (user.roleCreator) {
      userRoles.push('creator', 'solver');
    } else if (user.roleSolver) {
      userRoles.push('solver');
    }

    const hasRole = requiredRoles.some((r) => userRoles.includes(r));

    if (!hasRole) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
