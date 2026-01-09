import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Twilio } from 'twilio';

export type AlertLevel = 'info' | 'warning' | 'critical' | 'emergency';
export type AlertChannel = 'sms' | 'email' | 'web';

interface AlertMessage {
  level: AlertLevel;
  title: string;
  message: string;
  channels: AlertChannel[];
  metadata?: any;
}

interface AlertNotification {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  channels: AlertChannel[];
  sentAt: Date;
  sentTo: {
    sms?: string[];
    email?: string[];
  };
  metadata?: any;
}

/**
 * Multi-Channel Alert Service
 * 
 * Sends notifications via:
 * - SMS (Twilio) for critical/emergency alerts
 * - Email (nodemailer) for all alert levels
 * - Web (in-app notifications) for all alert levels
 * 
 * Alert Levels:
 * - info: Web only
 * - warning: Web + Email
 * - critical: Web + Email + SMS
 * - emergency: Web + Email + SMS (immediate delivery)
 */
@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private emailTransporter: nodemailer.Transporter;
  private twilioClient: Twilio;
  
  // In-memory storage for web notifications (in production: use Redis or DB)
  private webNotifications: Map<string, AlertNotification[]> = new Map();

  constructor(
    // @InjectRepository(AlertNotification)
    // private alertRepo: Repository<AlertNotification>,
  ) {
    this.initializeEmailTransporter();
    this.initializeTwilioClient();
  }

  /**
   * Initialize email transporter
   */
  private initializeEmailTransporter() {
    const emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    };

    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
      this.logger.warn('Email credentials not configured. Email alerts disabled.');
      return;
    }

    this.emailTransporter = nodemailer.createTransport(emailConfig);
    this.logger.log('Email transporter initialized');
  }

  /**
   * Initialize Twilio client
   */
  private initializeTwilioClient() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      this.logger.warn('Twilio credentials not configured. SMS alerts disabled.');
      return;
    }

    this.twilioClient = new Twilio(accountSid, authToken);
    this.logger.log('Twilio client initialized');
  }

  /**
   * Send alert via specified channels
   */
  async send(alert: AlertMessage): Promise<AlertNotification> {
    this.logger.log(`Sending ${alert.level} alert: ${alert.title}`);

    const notification: AlertNotification = {
      id: this.generateNotificationId(),
      level: alert.level,
      title: alert.title,
      message: alert.message,
      channels: alert.channels,
      sentAt: new Date(),
      sentTo: {},
      metadata: alert.metadata,
    };

    // Send to each channel
    const promises: Promise<any>[] = [];

    if (alert.channels.includes('web')) {
      promises.push(this.sendWebNotification(notification));
    }

    if (alert.channels.includes('email')) {
      promises.push(this.sendEmailNotification(notification));
    }

    if (alert.channels.includes('sms')) {
      promises.push(this.sendSMSNotification(notification));
    }

    // Wait for all channels to complete
    await Promise.allSettled(promises);

    // Store in database for history
    // await this.alertRepo.save(notification);

    return notification;
  }

  /**
   * Send web notification (in-app)
   */
  private async sendWebNotification(notification: AlertNotification): Promise<void> {
    this.logger.log(`Sending web notification: ${notification.title}`);

    // Get all admin users
    const adminUserIds = await this.getAdminUserIds();

    // Store notification for each admin
    for (const userId of adminUserIds) {
      if (!this.webNotifications.has(userId)) {
        this.webNotifications.set(userId, []);
      }

      this.webNotifications.get(userId)!.push(notification);

      // Keep only last 100 notifications per user
      const userNotifs = this.webNotifications.get(userId)!;
      if (userNotifs.length > 100) {
        this.webNotifications.set(userId, userNotifs.slice(-100));
      }
    }

    // In production: Also emit via WebSocket for real-time updates
    // this.websocketGateway.emit('notification', notification);

    this.logger.log(`Web notification sent to ${adminUserIds.length} admins`);
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: AlertNotification): Promise<void> {
    if (!this.emailTransporter) {
      this.logger.warn('Email transporter not configured. Skipping email notification.');
      return;
    }

    this.logger.log(`Sending email notification: ${notification.title}`);

    // Get admin email addresses
    const adminEmails = await this.getAdminEmails();

    if (adminEmails.length === 0) {
      this.logger.warn('No admin emails configured');
      return;
    }

    const subject = this.getEmailSubject(notification);
    const html = this.getEmailHTML(notification);

    try {
      const info = await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'RangeX Platform <noreply@rangex.com>',
        to: adminEmails.join(', '),
        subject,
        html,
      });

      notification.sentTo.email = adminEmails;
      this.logger.log(`Email sent: ${info.messageId}`);
    } catch (error: any) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(notification: AlertNotification): Promise<void> {
    if (!this.twilioClient) {
      this.logger.warn('Twilio client not configured. Skipping SMS notification.');
      return;
    }

    this.logger.log(`Sending SMS notification: ${notification.title}`);

    // Get admin phone numbers
    const adminPhones = await this.getAdminPhones();

    if (adminPhones.length === 0) {
      this.logger.warn('No admin phone numbers configured');
      return;
    }

    const smsBody = this.getSMSBody(notification);
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!fromNumber) {
      this.logger.error('TWILIO_PHONE_NUMBER not configured');
      return;
    }

    const sentTo: string[] = [];

    for (const phoneNumber of adminPhones) {
      try {
        const message = await this.twilioClient.messages.create({
          body: smsBody,
          from: fromNumber,
          to: phoneNumber,
        });

        sentTo.push(phoneNumber);
        this.logger.log(`SMS sent to ${phoneNumber}: ${message.sid}`);
      } catch (error: any) {
        this.logger.error(`Failed to send SMS to ${phoneNumber}: ${error.message}`);
      }
    }

    notification.sentTo.sms = sentTo;
  }

  /**
   * Get email subject based on alert level
   */
  private getEmailSubject(notification: AlertNotification): string {
    const prefix = {
      info: 'ℹ️ Info',
      warning: '⚠️ Warning',
      critical: '🚨 CRITICAL',
      emergency: '🆘 EMERGENCY',
    }[notification.level];

    return `[RangeX] ${prefix}: ${notification.title}`;
  }

  /**
   * Get email HTML body
   */
  private getEmailHTML(notification: AlertNotification): string {
    const color = {
      info: '#3b82f6',
      warning: '#f59e0b',
      critical: '#ef4444',
      emergency: '#dc2626',
    }[notification.level];

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
          .footer { background: #f3f4f6; padding: 10px 20px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; }
          .timestamp { font-size: 14px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${notification.title}</h2>
            <p class="timestamp">${notification.sentAt.toLocaleString()}</p>
          </div>
          <div class="content">
            <pre style="white-space: pre-wrap; font-family: monospace; font-size: 13px;">${notification.message}</pre>
            ${notification.metadata ? `
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
              <h4>Additional Details:</h4>
              <pre style="background: white; padding: 10px; border-radius: 4px; font-size: 12px;">${JSON.stringify(notification.metadata, null, 2)}</pre>
            ` : ''}
          </div>
          <div class="footer">
            <p>This is an automated alert from RangeX Platform. Please do not reply to this email.</p>
            <p>Alert ID: ${notification.id}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get SMS body (limited to 160 characters for standard SMS)
   */
  private getSMSBody(notification: AlertNotification): string {
    const prefix = {
      info: '[INFO]',
      warning: '[WARN]',
      critical: '[CRIT]',
      emergency: '[EMRG]',
    }[notification.level];

    // Truncate message to fit SMS limits
    const maxLength = 140; // Leave room for prefix
    let message = notification.message;
    
    if (message.length > maxLength) {
      message = message.substring(0, maxLength - 3) + '...';
    }

    return `${prefix} RangeX: ${notification.title}\n${message}`;
  }

  /**
   * Get admin user IDs (for web notifications)
   */
  private async getAdminUserIds(): Promise<string[]> {
    // In production: Query from users table where role = 'admin'
    // For now: Return hardcoded or from env
    const adminIds = process.env.ADMIN_USER_IDS?.split(',') || [];
    return adminIds;
  }

  /**
   * Get admin email addresses
   */
  private async getAdminEmails(): Promise<string[]> {
    // In production: Query from users table
    // For now: Return from env
    const emails = process.env.ADMIN_EMAILS?.split(',') || [];
    return emails;
  }

  /**
   * Get admin phone numbers
   */
  private async getAdminPhones(): Promise<string[]> {
    // In production: Query from users table
    // For now: Return from env
    const phones = process.env.ADMIN_PHONES?.split(',') || [];
    return phones.filter((p) => p.startsWith('+')); // Ensure E.164 format
  }

  /**
   * Get web notifications for a user
   */
  getWebNotifications(userId: string, limit = 50): AlertNotification[] {
    const notifications = this.webNotifications.get(userId) || [];
    return notifications.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Mark web notification as read
   */
  markAsRead(userId: string, notificationId: string): void {
    const notifications = this.webNotifications.get(userId) || [];
    const notification = notifications.find((n) => n.id === notificationId);
    
    if (notification) {
      notification.metadata = { ...notification.metadata, read: true };
    }
  }

  /**
   * Helper: Send cost alert
   */
  async sendCostAlert(type: 'daily_warning' | 'monthly_warning' | 'budget_exceeded', data: any): Promise<void> {
    const levelMap = {
      daily_warning: 'warning' as AlertLevel,
      monthly_warning: 'critical' as AlertLevel,
      budget_exceeded: 'emergency' as AlertLevel,
    };

    const channelMap = {
      daily_warning: ['web', 'email'] as AlertChannel[],
      monthly_warning: ['web', 'email', 'sms'] as AlertChannel[],
      budget_exceeded: ['web', 'email', 'sms'] as AlertChannel[],
    };

    await this.send({
      level: levelMap[type],
      title: `Cost Alert: ${type.replace(/_/g, ' ').toUpperCase()}`,
      message: JSON.stringify(data, null, 2),
      channels: channelMap[type],
      metadata: { type: 'cost_alert', ...data },
    });
  }

  /**
   * Helper: Send health alert
   */
  async sendHealthAlert(type: 'container_unhealthy' | 'orphaned_task' | 'aws_config_issue', data: any): Promise<void> {
    await this.send({
      level: type === 'aws_config_issue' ? 'critical' : 'warning',
      title: `Health Alert: ${type.replace(/_/g, ' ').toUpperCase()}`,
      message: JSON.stringify(data, null, 2),
      channels: ['web', 'email'],
      metadata: { type: 'health_alert', ...data },
    });
  }

  /**
   * Helper: Generate unique notification ID
   */
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
