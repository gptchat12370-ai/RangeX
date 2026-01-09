import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { BudgetExceededError } from '../errors/budget-exceeded.error';
import { LimitExceededError } from '../errors/limit-exceeded.error';
import { MaintenanceModeError } from '../errors/maintenance-mode.error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };

    if (exception instanceof BudgetExceededError) {
      status = HttpStatus.FORBIDDEN;
      body = {
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    } else if (exception instanceof LimitExceededError) {
      status = HttpStatus.CONFLICT;
      body = {
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    } else if (exception instanceof MaintenanceModeError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      body = { code: exception.code, message: exception.message };
    } else if (exception instanceof BadRequestException) {
      status = exception.getStatus();
      body = {
        code: 'VALIDATION_ERROR',
        message: exception.message,
        details: exception.getResponse(),
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      body = {
        code: res?.code || 'HTTP_ERROR',
        message: res?.message || exception.message,
        details: res?.details,
      };
    } else if (exception instanceof Error) {
      body = {
        code: 'INTERNAL_ERROR',
        message: exception.message,
      };
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled exception: ${body.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(body);
  }
}
