import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { Request } from 'express';

export interface AuditLogEntry {
  userId?: string;
  actionType: string;
  details?: Record<string, any>;
  req?: Request;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(entry: AuditLogEntry): Promise<AuditLog> {
    const { userId, actionType, details, req } = entry;
    const ipAddress = req?.ip;
    const userAgent = req?.headers['user-agent'];

    const log = this.auditLogRepository.create({
      userId,
      actionType,
      details,
      ipAddress,
      userAgent,
    });

    return this.auditLogRepository.save(log);
  }

  async findAll(): Promise<AuditLog[]> {
    return this.auditLogRepository.find({ order: { timestamp: 'DESC' } });
  }

  async findByUserId(userId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({ where: { userId }, order: { timestamp: 'DESC' } });
  }
}
