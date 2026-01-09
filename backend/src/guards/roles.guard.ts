import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Check boolean role flags from JWT payload
    const userRoles: string[] = [];
    if (user.roleAdmin) userRoles.push('admin', 'superadmin');
    if (user.roleCreator) userRoles.push('creator');
    if (user.roleSolver) userRoles.push('solver');

    // Check if user has any of the required roles
    return requiredRoles.some(role => userRoles.includes(role));
  }
}
