import {
  NotificationMessage,
  NotificationUser,
  NotificationType,
  NotificationStatus,
  NotificationDelivery,
  EmailNotificationService,
  EmailOptions,
  EmailAttachment,
  EmailDelivery,
  NotificationRetryConfig,
  NotificationRateLimit,
  DeliveryStatus
} from './types';

/**
 * Email Notifications Service
 * Handles email delivery with templates, attachments, and advanced features
 */
export class EmailNotificationsService implements EmailNotificationService {
  private retryConfig: NotificationRetryConfig;
  private rateLimit: NotificationRateLimit;
  private emailQueue: NotificationMessage[] = [];
  private deliveryHistory: Map<string, EmailDelivery[]> = new Map();
  private smtpConfig: SMTPConfig;
  private templateEngine: EmailTemplateEngine;

  constructor(
    retryConfig: NotificationRetryConfig,
    rateLimit: NotificationRateLimit,
    smtpConfig: SMTPConfig
  ) {
    this.retryConfig = retryConfig;
    this.rateLimit = rateLimit;
    this.smtpConfig = smtpConfig;
    this.templateEngine = new EmailTemplateEngine();
    this.startEmailProcessor();
  }

  /**
   * Send email notification
   */
  public async sendEmail(
    to: string,
    subject: string,
    content: string,
    options?: EmailOptions
  ): Promise<EmailDelivery> {
    try {
      // Validate email address
      if (!await this.validateEmailAddress(to)) {
        throw new Error(`Invalid email address: ${to}`);
      }

      // Check rate limits
      if (this.rateLimit.enabled && !this.checkRateLimit(to)) {
        throw new Error('Rate limit exceeded for email address');
      }

      // Create email message
      const emailMessage = this.createEmailMessage(to, subject, content, options);

      // Add to queue
      this.emailQueue.push(emailMessage);

      // Process immediately for high priority emails
      if (emailMessage.priority?.level === 'HIGH' || emailMessage.priority?.level === 'CRITICAL') {
        return this.processEmail(emailMessage);
      }

      return this.createEmailDelivery(emailMessage);
    } catch (error) {
      this.logError('Failed to send email', error, { to, subject });
      throw error;
    }
  }

  /**
   * Send template email
   */
  public async sendTemplateEmail(
    to: string,
    templateId: string,
    variables: Record<string, any>
  ): Promise<EmailDelivery> {
    try {
      // Get template
      const template = await this.templateEngine.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Render template
      const rendered = await this.templateEngine.renderTemplate(template, variables);

      // Send email
      return this.sendEmail(to, rendered.subject, rendered.content, {
        from: template.from,
        replyTo: template.replyTo,
        priority: template.priority
      });
    } catch (error) {
      this.logError('Failed to send template email', error, { to, templateId });
      throw error;
    }
  }

  /**
   * Validate email address
   */
  public async validateEmailAddress(email: string): Promise<boolean> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get email status
   */
  public async getEmailStatus(messageId: string): Promise<EmailDelivery> {
    const history = this.deliveryHistory.get(messageId) || [];
    return history[history.length - 1] || this.createEmailDelivery({} as NotificationMessage);
  }

  /**
   * Send notification (implements NotificationService interface)
   */
  public async send(message: NotificationMessage): Promise<NotificationDelivery> {
    const emailDelivery = await this.sendEmail(
      message.recipient.email,
      message.subject || 'Notification',
      message.content,
      {
        from: this.smtpConfig.from,
        priority: this.mapPriorityToEmailPriority(message.priority.level)
      }
    );

    return {
      id: emailDelivery.id,
      messageId: message.id,
      channel: { type: 'EMAIL', enabled: true, priority: message.priority },
      status: emailDelivery.status,
      attemptNumber: 1,
      attemptedAt: emailDelivery.sentAt,
      deliveredAt: emailDelivery.deliveredAt,
      failedAt: emailDelivery.bouncedAt,
      errorMessage: emailDelivery.errorMessage,
      response: emailDelivery.response,
      metadata: {}
    };
  }

  /**
   * Send batch of notifications
   */
  public async sendBatch(messages: NotificationMessage[]): Promise<any> {
    const results: EmailDelivery[] = [];

    for (const message of messages) {
      try {
        const delivery = await this.send(message);
        results.push(delivery as unknown as EmailDelivery);
      } catch (error) {
        this.logError('Batch email failed', error, { messageId: message.id });
      }
    }

    return results;
  }

  /**
   * Schedule notification for later delivery
   */
  public async schedule(message: NotificationMessage, scheduledAt: Date): Promise<void> {
    message.status = NotificationStatus.SCHEDULED;
    message.scheduledAt = scheduledAt;
    message.updatedAt = new Date();
    this.emailQueue.push(message);
    this.logInfo('Email scheduled', { messageId: message.id, scheduledAt });
  }

  /**
   * Cancel notification
   */
  public async cancel(messageId: string): Promise<void> {
    const message = this.emailQueue.find(m => m.id === messageId);
    if (message) {
      message.status = NotificationStatus.CANCELLED;
      message.updatedAt = new Date();
      this.logInfo('Email cancelled', { messageId });
    }
  }

  /**
   * Get notification status
   */
  public async getStatus(messageId: string): Promise<NotificationStatus> {
    const message = this.emailQueue.find(m => m.id === messageId);
    return message ? message.status : NotificationStatus.PENDING;
  }

  /**
   * Get delivery history for a message
   */
  public async getDeliveryHistory(messageId: string): Promise<NotificationDelivery[]> {
    return (this.deliveryHistory.get(messageId) || []) as unknown as NotificationDelivery[];
  }

  /**
   * Process email from queue
   */
  private async processEmail(message: NotificationMessage): Promise<EmailDelivery> {
    const delivery = this.createEmailDelivery(message);

    try {
      message.status = NotificationStatus.SENDING;
      message.deliveryAttempts++;
      message.updatedAt = new Date();

      // Send email via SMTP
      await this.sendViaSMTP(message, delivery);

      message.status = NotificationStatus.DELIVERED;
      message.deliveredAt = new Date();
      message.updatedAt = new Date();

      delivery.status = DeliveryStatus.DELIVERED;
      delivery.deliveredAt = new Date();

      this.logInfo('Email delivered successfully', { messageId: message.id });
    } catch (error) {
      message.status = NotificationStatus.FAILED;
      message.failedAt = new Date();
      message.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      message.updatedAt = new Date();

      delivery.status = DeliveryStatus.FAILED;
      delivery.failedAt = new Date();
      delivery.errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logError('Email delivery failed', error, { messageId: message.id });
    }

    // Store delivery record
    const history = this.deliveryHistory.get(message.id) || [];
    history.push(delivery);
    this.deliveryHistory.set(message.id, history);

    return delivery;
  }

  /**
   * Send email via SMTP
   */
  private async sendViaSMTP(message: NotificationMessage, delivery: EmailDelivery): Promise<void> {
    try {
      // Simulate SMTP sending
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In a real implementation, you would use a library like nodemailer
      const emailData = {
        to: message.recipient.email,
        subject: message.subject,
        html: this.formatEmailContent(message.content),
        from: this.smtpConfig.from,
        replyTo: this.smtpConfig.replyTo,
        attachments: this.processAttachments(message.data?.attachments || [])
      };

      // Simulate SMTP response
      delivery.response = {
        messageId: `<${Date.now()}@${this.smtpConfig.host}>`,
        accepted: [message.recipient.email],
        rejected: []
      };

      this.logInfo('Email sent via SMTP', {
        messageId: message.id,
        to: message.recipient.email,
        smtpMessageId: delivery.response.messageId
      });
    } catch (error) {
      throw new Error(`SMTP delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format email content as HTML
   */
  private formatEmailContent(content: string): string {
    // Convert plain text to HTML
    const htmlContent = content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; }
            .content { padding: 20px 0; }
            .footer { background-color: #f4f4f4; padding: 20px; border-radius: 5px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Smart Campus Assistant</h2>
            </div>
            <div class="content">
              ${htmlContent}
            </div>
            <div class="footer">
              <p>This is an automated message from the Smart Campus Assistant system.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Process email attachments
   */
  private processAttachments(attachments: EmailAttachment[]): any[] {
    return attachments.map(attachment => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
      disposition: attachment.disposition || 'attachment',
      cid: attachment.cid
    }));
  }

  /**
   * Create email message
   */
  private createEmailMessage(
    to: string,
    subject: string,
    content: string,
    options?: EmailOptions
  ): NotificationMessage {
    return {
      id: this.generateMessageId(),
      type: NotificationType.ATTENDANCE,
      category: 'email',
      priority: { level: 'MEDIUM', escalation: { enabled: false, delay: 0, escalateTo: [] } },
      recipient: {
        id: 0,
        email: to,
        firstName: '',
        lastName: '',
        preferences: {} as any,
        timezone: 'UTC',
        language: 'en'
      },
      subject,
      content,
      data: options,
      channels: [{ type: 'EMAIL', enabled: true, priority: { level: 'MEDIUM', escalation: { enabled: false, delay: 0, escalateTo: [] } } }],
      status: NotificationStatus.PENDING,
      deliveryAttempts: 0,
      maxRetries: this.retryConfig.maxAttempts,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Create email delivery record
   */
  private createEmailDelivery(message: NotificationMessage): EmailDelivery {
    return {
      id: this.generateDeliveryId(),
      messageId: message.id,
      to: message.recipient.email,
      status: DeliveryStatus.PENDING,
      sentAt: new Date()
    };
  }

  /**
   * Map notification priority to email priority
   */
  private mapPriorityToEmailPriority(priority: string): 'LOW' | 'NORMAL' | 'HIGH' {
    const mapping: Record<string, 'LOW' | 'NORMAL' | 'HIGH'> = {
      'LOW': 'LOW',
      'MEDIUM': 'NORMAL',
      'HIGH': 'HIGH',
      'CRITICAL': 'HIGH',
      'EMERGENCY': 'HIGH'
    };
    return mapping[priority] || 'NORMAL';
  }

  /**
   * Check rate limits
   */
  private checkRateLimit(email: string): boolean {
    // Simplified rate limit check
    // In a real implementation, you would check against a rate limit store
    return true;
  }

  /**
   * Start email processor
   */
  private startEmailProcessor(): void {
    setInterval(() => {
      this.processEmailQueue();
    }, 5000); // Process every 5 seconds
  }

  /**
   * Process email queue
   */
  private async processEmailQueue(): Promise<void> {
    const pendingEmails = this.emailQueue.filter(
      m => m.status === NotificationStatus.PENDING &&
        (!m.scheduledAt || m.scheduledAt <= new Date())
    );

    for (const email of pendingEmails.slice(0, 5)) { // Process up to 5 emails at a time
      try {
        await this.processEmail(email);
      } catch (error) {
        this.logError('Email processing failed', error, { messageId: email.id });
      }
    }
  }

  /**
   * Generate message ID
   */
  private generateMessageId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate delivery ID
   */
  private generateDeliveryId(): string {
    return `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log info message
   */
  private logInfo(message: string, data?: any): void {
    console.log(`[EmailNotifications] ${message}`, data || '');
  }

  /**
   * Log error message
   */
  private logError(message: string, error: any, data?: any): void {
    console.error(`[EmailNotifications] ${message}`, error, data || '');
  }
}

/**
 * SMTP Configuration
 */
interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  replyTo?: string;
}

/**
 * Email Template Engine
 */
class EmailTemplateEngine {
  private templates: Map<string, EmailTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Get template by ID
   */
  public async getTemplate(templateId: string): Promise<EmailTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  /**
   * Render template with variables
   */
  public async renderTemplate(template: EmailTemplate, variables: Record<string, any>): Promise<{ subject: string; content: string }> {
    let subject = template.subject || '';
    let content = template.content;

    // Replace variables in subject
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), String(value));
      content = content.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return { subject, content };
  }

  /**
   * Initialize default templates
   */
  private initializeDefaultTemplates(): void {
    // Attendance confirmation template
    this.templates.set('attendance-confirmation', {
      id: 'attendance-confirmation',
      name: 'Attendance Confirmation',
      type: NotificationType.ATTENDANCE,
      category: 'attendance',
      language: 'en',
      version: '1.0',
      subject: 'Attendance Confirmed - {{sessionId}}',
      content: `
        Dear {{firstName}} {{lastName}},
        
        Your attendance has been successfully recorded for session {{sessionId}}.
        
        Details:
        - Status: {{status}}
        - Time: {{timestamp}}
        - Location: {{location}}
        
        Thank you for your attendance.
        
        Best regards,
        Smart Campus Assistant
      `,
      variables: [
        { name: 'firstName', type: 'STRING', required: true, description: 'Student first name' },
        { name: 'lastName', type: 'STRING', required: true, description: 'Student last name' },
        { name: 'sessionId', type: 'STRING', required: true, description: 'Session ID' },
        { name: 'status', type: 'STRING', required: true, description: 'Attendance status' },
        { name: 'timestamp', type: 'DATE', required: true, description: 'Attendance timestamp' },
        { name: 'location', type: 'STRING', required: false, description: 'Attendance location' }
      ],
      metadata: {
        created: new Date(),
        updated: new Date(),
        author: 'system',
        tags: ['attendance', 'confirmation']
      }
    });

    // Fraud alert template
    this.templates.set('fraud-alert', {
      id: 'fraud-alert',
      name: 'Fraud Alert',
      type: NotificationType.FRAUD_ALERT,
      category: 'security',
      language: 'en',
      version: '1.0',
      subject: 'Security Alert: {{alertType}}',
      content: `
        Security Alert
        
        A potential security issue has been detected:
        
        Type: {{alertType}}
        Severity: {{severity}}
        Description: {{description}}
        Risk Score: {{riskScore}}
        Time: {{timestamp}}
        
        Please review your account activity and contact support if you have any concerns.
        
        Best regards,
        Security Team
      `,
      variables: [
        { name: 'alertType', type: 'STRING', required: true, description: 'Type of alert' },
        { name: 'severity', type: 'STRING', required: true, description: 'Alert severity' },
        { name: 'description', type: 'STRING', required: true, description: 'Alert description' },
        { name: 'riskScore', type: 'NUMBER', required: true, description: 'Risk score' },
        { name: 'timestamp', type: 'DATE', required: true, description: 'Alert timestamp' }
      ],
      metadata: {
        created: new Date(),
        updated: new Date(),
        author: 'system',
        tags: ['security', 'fraud', 'alert']
      }
    });

    // Security warning template
    this.templates.set('security-warning', {
      id: 'security-warning',
      name: 'Security Warning',
      type: NotificationType.SECURITY_WARNING,
      category: 'security',
      language: 'en',
      version: '1.0',
      subject: 'Security Warning: {{warningType}}',
      content: `
        Security Warning
        
        {{description}}
        
        Type: {{warningType}}
        Severity: {{severity}}
        Time: {{timestamp}}
        
        Recommendations:
        {{#each recommendations}}
        - {{this}}
        {{/each}}
        
        Please take appropriate action to secure your account.
        
        Best regards,
        Security Team
      `,
      variables: [
        { name: 'warningType', type: 'STRING', required: true, description: 'Type of warning' },
        { name: 'severity', type: 'STRING', required: true, description: 'Warning severity' },
        { name: 'description', type: 'STRING', required: true, description: 'Warning description' },
        { name: 'timestamp', type: 'DATE', required: true, description: 'Warning timestamp' },
        { name: 'recommendations', type: 'OBJECT', required: false, description: 'Security recommendations' }
      ],
      metadata: {
        created: new Date(),
        updated: new Date(),
        author: 'system',
        tags: ['security', 'warning']
      }
    });
  }
}

/**
 * Email Template Interface
 */
interface EmailTemplate {
  id: string;
  name: string;
  type: NotificationType;
  category: string;
  language: string;
  version: string;
  subject?: string;
  content: string;
  from?: string;
  replyTo?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  variables: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  metadata: {
    created: Date;
    updated: Date;
    author: string;
    tags: string[];
  };
}
