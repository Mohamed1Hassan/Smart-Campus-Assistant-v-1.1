import {
  NotificationMessage,
  NotificationUser,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  NotificationChannel,
  AttendanceNotificationData,
  FraudAlertNotificationData,
  LocationVerificationNotificationData,
  SessionStatusNotificationData,
  EmergencyNotificationData,
  SecurityWarningNotificationData,
  NotificationService,
  NotificationDelivery,
  NotificationBatch,
  NotificationRetryConfig,
  NotificationRateLimit,
  BatchStatus,
  DeliveryStatus
} from './types';

/**
 * Attendance Notifications Service
 * Handles real-time attendance notifications, fraud alerts, and security warnings
 */
export class AttendanceNotificationsService implements NotificationService {
  private retryConfig: NotificationRetryConfig;
  private rateLimit: NotificationRateLimit;
  private messageQueue: NotificationMessage[] = [];
  private deliveryHistory: Map<string, NotificationDelivery[]> = new Map();
  private activeBatches: Map<string, NotificationBatch> = new Map();

  constructor(
    retryConfig: NotificationRetryConfig,
    rateLimit: NotificationRateLimit
  ) {
    this.retryConfig = retryConfig;
    this.rateLimit = rateLimit;
    this.startMessageProcessor();
  }

  /**
   * Send attendance notification
   */
  public async sendAttendanceNotification(
    user: NotificationUser,
    data: AttendanceNotificationData,
    channels: NotificationChannel[]
  ): Promise<NotificationDelivery> {
    const message: NotificationMessage = {
      id: this.generateMessageId(),
      type: NotificationType.ATTENDANCE,
      category: 'attendance',
      priority: this.getPriorityForStatus(data.status),
      recipient: user,
      subject: this.generateAttendanceSubject(data),
      content: this.generateAttendanceContent(data, user.language),
      data: data,
      channels,
      status: NotificationStatus.PENDING,
      deliveryAttempts: 0,
      maxRetries: this.retryConfig.maxAttempts,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return this.send(message);
  }

  /**
   * Send fraud alert notification
   */
  public async sendFraudAlertNotification(
    user: NotificationUser,
    data: FraudAlertNotificationData,
    channels: NotificationChannel[]
  ): Promise<NotificationDelivery> {
    const message: NotificationMessage = {
      id: this.generateMessageId(),
      type: NotificationType.FRAUD_ALERT,
      category: 'security',
      priority: this.getPriorityForSeverity(data.severity),
      recipient: user,
      subject: this.generateFraudAlertSubject(data),
      content: this.generateFraudAlertContent(data, user.language),
      data: data,
      channels,
      status: NotificationStatus.PENDING,
      deliveryAttempts: 0,
      maxRetries: this.retryConfig.maxAttempts,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return this.send(message);
  }

  /**
   * Send location verification notification
   */
  public async sendLocationVerificationNotification(
    user: NotificationUser,
    data: LocationVerificationNotificationData,
    channels: NotificationChannel[]
  ): Promise<NotificationDelivery> {
    const message: NotificationMessage = {
      id: this.generateMessageId(),
      type: NotificationType.LOCATION_VERIFICATION,
      category: 'security',
      priority: this.getPriorityForStatus(data.status),
      recipient: user,
      subject: this.generateLocationVerificationSubject(data),
      content: this.generateLocationVerificationContent(data, user.language),
      data: data,
      channels,
      status: NotificationStatus.PENDING,
      deliveryAttempts: 0,
      maxRetries: this.retryConfig.maxAttempts,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return this.send(message);
  }

  /**
   * Send session status notification
   */
  public async sendSessionStatusNotification(
    users: NotificationUser[],
    data: SessionStatusNotificationData,
    channels: NotificationChannel[]
  ): Promise<NotificationBatch> {
    const messages: NotificationMessage[] = users.map(user => ({
      id: this.generateMessageId(),
      type: NotificationType.SESSION_STATUS,
      category: 'session',
      priority: this.getPriorityForSessionStatus(data.status),
      recipient: user,
      subject: this.generateSessionStatusSubject(data),
      content: this.generateSessionStatusContent(data, user.language),
      data: data,
      channels,
      status: NotificationStatus.PENDING,
      deliveryAttempts: 0,
      maxRetries: this.retryConfig.maxAttempts,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    return this.sendBatch(messages);
  }

  /**
   * Send emergency notification
   */
  public async sendEmergencyNotification(
    users: NotificationUser[],
    data: EmergencyNotificationData,
    channels: NotificationChannel[]
  ): Promise<NotificationBatch> {
    const messages: NotificationMessage[] = users.map(user => ({
      id: this.generateMessageId(),
      type: NotificationType.EMERGENCY,
      category: 'emergency',
      priority: this.getPriorityForSeverity(data.severity),
      recipient: user,
      subject: this.generateEmergencySubject(data),
      content: this.generateEmergencyContent(data, user.language),
      data: data,
      channels,
      status: NotificationStatus.PENDING,
      deliveryAttempts: 0,
      maxRetries: this.retryConfig.maxAttempts,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    return this.sendBatch(messages);
  }

  /**
   * Send security warning notification
   */
  public async sendSecurityWarningNotification(
    user: NotificationUser,
    data: SecurityWarningNotificationData,
    channels: NotificationChannel[]
  ): Promise<NotificationDelivery> {
    const message: NotificationMessage = {
      id: this.generateMessageId(),
      type: NotificationType.SECURITY_WARNING,
      category: 'security',
      priority: this.getPriorityForSeverity(data.severity),
      recipient: user,
      subject: this.generateSecurityWarningSubject(data),
      content: this.generateSecurityWarningContent(data, user.language),
      data: data,
      channels,
      status: NotificationStatus.PENDING,
      deliveryAttempts: 0,
      maxRetries: this.retryConfig.maxAttempts,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return this.send(message);
  }

  /**
   * Send notification (implements NotificationService interface)
   */
  public async send(message: NotificationMessage): Promise<NotificationDelivery> {
    try {
      // Check rate limits
      if (this.rateLimit.enabled && !this.checkRateLimit(message.recipient.id)) {
        throw new Error('Rate limit exceeded');
      }

      // Add to queue
      this.messageQueue.push(message);

      // Process immediately for high priority messages
      if (message.priority.level === 'CRITICAL' || message.priority.level === 'EMERGENCY') {
        return this.processMessage(message);
      }

      return this.createDeliveryRecord(message);
    } catch (error) {
      this.logError('Failed to send notification', error, { messageId: message.id });
      throw error;
    }
  }

  /**
   * Send batch of notifications
   */
  public async sendBatch(messages: NotificationMessage[]): Promise<NotificationBatch> {
    const batchId = this.generateBatchId();
    const batch: NotificationBatch = {
      id: batchId,
      name: `Batch_${batchId}`,
      messages,
      status: BatchStatus.PENDING,
      createdAt: new Date()
    };

    this.activeBatches.set(batchId, batch);

    try {
      // Process messages in parallel with concurrency limit
      const concurrencyLimit = 5;
      const results: NotificationDelivery[] = [];

      for (let i = 0; i < messages.length; i += concurrencyLimit) {
        const batch = messages.slice(i, i + concurrencyLimit);
        const promises = batch.map(message => this.send(message));
        const batchResults = await Promise.allSettled(promises);

        results.push(...batchResults
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<NotificationDelivery>).value)
        );
      }

      batch.status = BatchStatus.COMPLETED;
      batch.completedAt = new Date();

      return batch;
    } catch (error) {
      batch.status = BatchStatus.FAILED;
      batch.failedAt = new Date();
      batch.errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logError('Batch processing failed', error, { batchId });
      throw error;
    }
  }

  /**
   * Schedule notification for later delivery
   */
  public async schedule(message: NotificationMessage, scheduledAt: Date): Promise<void> {
    message.status = NotificationStatus.SCHEDULED;
    message.scheduledAt = scheduledAt;
    message.updatedAt = new Date();

    // Store in database or queue for scheduled delivery
    this.logInfo('Notification scheduled', { messageId: message.id, scheduledAt });
  }

  /**
   * Cancel notification
   */
  public async cancel(messageId: string): Promise<void> {
    const message = this.messageQueue.find(m => m.id === messageId);
    if (message) {
      message.status = NotificationStatus.CANCELLED;
      message.updatedAt = new Date();
      this.logInfo('Notification cancelled', { messageId });
    }
  }

  /**
   * Get notification status
   */
  public async getStatus(messageId: string): Promise<NotificationStatus> {
    const message = this.messageQueue.find(m => m.id === messageId);
    return message ? message.status : NotificationStatus.PENDING;
  }

  /**
   * Get delivery history for a message
   */
  public async getDeliveryHistory(messageId: string): Promise<NotificationDelivery[]> {
    return this.deliveryHistory.get(messageId) || [];
  }

  /**
   * Process message from queue
   */
  private async processMessage(message: NotificationMessage): Promise<NotificationDelivery> {
    const delivery = this.createDeliveryRecord(message);

    try {
      message.status = NotificationStatus.SENDING;
      message.deliveryAttempts++;
      message.updatedAt = new Date();

      // Simulate delivery to different channels
      for (const channel of message.channels) {
        await this.deliverToChannel(message, channel);
      }

      message.status = NotificationStatus.DELIVERED;
      message.deliveredAt = new Date();
      message.updatedAt = new Date();

      delivery.status = DeliveryStatus.DELIVERED;
      delivery.deliveredAt = new Date();

      this.logInfo('Notification delivered successfully', { messageId: message.id });
    } catch (error) {
      message.status = NotificationStatus.FAILED;
      message.failedAt = new Date();
      message.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      message.updatedAt = new Date();

      delivery.status = DeliveryStatus.FAILED;
      delivery.failedAt = new Date();
      delivery.errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logError('Notification delivery failed', error, { messageId: message.id });
    }

    // Store delivery record
    const history = this.deliveryHistory.get(message.id) || [];
    history.push(delivery);
    this.deliveryHistory.set(message.id, history);

    return delivery;
  }

  /**
   * Deliver message to specific channel
   */
  private async deliverToChannel(message: NotificationMessage, channel: NotificationChannel): Promise<void> {
    // Simulate channel-specific delivery
    switch (channel.type) {
      case 'EMAIL':
        await this.deliverEmail(message, channel);
        break;
      case 'PUSH':
        await this.deliverPush(message, channel);
        break;
      case 'SMS':
        await this.deliverSMS(message, channel);
        break;
      case 'IN_APP':
        await this.deliverInApp(message, channel);
        break;
      case 'WEBHOOK':
        await this.deliverWebhook(message, channel);
        break;
      default:
        throw new Error(`Unsupported channel type: ${channel.type}`);
    }
  }

  /**
   * Deliver email notification
   */
  private async deliverEmail(message: NotificationMessage, channel: NotificationChannel): Promise<void> {
    // Simulate email delivery
    await new Promise(resolve => setTimeout(resolve, 100));
    this.logInfo('Email delivered', { messageId: message.id, to: message.recipient.email });
  }

  /**
   * Deliver push notification
   */
  private async deliverPush(message: NotificationMessage, channel: NotificationChannel): Promise<void> {
    // Simulate push notification delivery
    await new Promise(resolve => setTimeout(resolve, 50));
    this.logInfo('Push notification delivered', { messageId: message.id, to: message.recipient.id });
  }

  /**
   * Deliver SMS notification
   */
  private async deliverSMS(message: NotificationMessage, channel: NotificationChannel): Promise<void> {
    // Simulate SMS delivery
    await new Promise(resolve => setTimeout(resolve, 200));
    this.logInfo('SMS delivered', { messageId: message.id, to: message.recipient.phoneNumber });
  }

  /**
   * Deliver in-app notification
   */
  private async deliverInApp(message: NotificationMessage, channel: NotificationChannel): Promise<void> {
    // Simulate in-app notification delivery
    await new Promise(resolve => setTimeout(resolve, 10));
    this.logInfo('In-app notification delivered', { messageId: message.id, to: message.recipient.id });
  }

  /**
   * Deliver webhook notification
   */
  private async deliverWebhook(message: NotificationMessage, channel: NotificationChannel): Promise<void> {
    if (!channel.webhookUrl) {
      throw new Error('Webhook URL not provided');
    }

    // Simulate webhook delivery
    await new Promise(resolve => setTimeout(resolve, 300));
    this.logInfo('Webhook delivered', { messageId: message.id, url: channel.webhookUrl });
  }

  /**
   * Start message processor
   */
  private startMessageProcessor(): void {
    setInterval(() => {
      this.processMessageQueue();
    }, 1000); // Process every second
  }

  /**
   * Process message queue
   */
  private async processMessageQueue(): Promise<void> {
    const pendingMessages = this.messageQueue.filter(
      m => m.status === NotificationStatus.PENDING &&
        (!m.scheduledAt || m.scheduledAt <= new Date())
    );

    for (const message of pendingMessages.slice(0, 10)) { // Process up to 10 messages at a time
      try {
        await this.processMessage(message);
      } catch (error) {
        this.logError('Message processing failed', error, { messageId: message.id });
      }
    }
  }

  /**
   * Check rate limits
   */
  private checkRateLimit(userId: number): boolean {
    // Simplified rate limit check
    // In a real implementation, you would check against a rate limit store
    return true;
  }

  /**
   * Create delivery record
   */
  private createDeliveryRecord(message: NotificationMessage): NotificationDelivery {
    return {
      id: this.generateDeliveryId(),
      messageId: message.id,
      channel: message.channels[0], // Simplified - would handle multiple channels
      status: DeliveryStatus.PENDING,
      attemptNumber: message.deliveryAttempts + 1,
      attemptedAt: new Date(),
      metadata: {}
    };
  }

  /**
   * Generate message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate delivery ID
   */
  private generateDeliveryId(): string {
    return `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get priority for attendance status
   */
  private getPriorityForStatus(status: string): NotificationPriority {
    const priorities: Record<string, NotificationPriority> = {
      'PRESENT': { level: 'LOW', escalation: { enabled: false, delay: 0, escalateTo: [] } },
      'ABSENT': { level: 'MEDIUM', escalation: { enabled: true, delay: 30, escalateTo: ['professor'] } },
      'LATE': { level: 'MEDIUM', escalation: { enabled: false, delay: 0, escalateTo: [] } },
      'EXCUSED': { level: 'LOW', escalation: { enabled: false, delay: 0, escalateTo: [] } }
    };
    return priorities[status] || priorities['PRESENT'];
  }

  /**
   * Get priority for severity
   */
  private getPriorityForSeverity(severity: string): NotificationPriority {
    const priorities: Record<string, NotificationPriority> = {
      'LOW': { level: 'LOW', escalation: { enabled: false, delay: 0, escalateTo: [] } },
      'MEDIUM': { level: 'MEDIUM', escalation: { enabled: true, delay: 15, escalateTo: ['admin'] } },
      'HIGH': { level: 'HIGH', escalation: { enabled: true, delay: 5, escalateTo: ['admin', 'security'] } },
      'CRITICAL': { level: 'CRITICAL', escalation: { enabled: true, delay: 1, escalateTo: ['admin', 'security', 'emergency'] } }
    };
    return priorities[severity] || priorities['LOW'];
  }

  /**
   * Get priority for session status
   */
  private getPriorityForSessionStatus(status: string): NotificationPriority {
    const priorities: Record<string, NotificationPriority> = {
      'STARTED': { level: 'MEDIUM', escalation: { enabled: false, delay: 0, escalateTo: [] } },
      'ENDED': { level: 'LOW', escalation: { enabled: false, delay: 0, escalateTo: [] } },
      'CANCELLED': { level: 'HIGH', escalation: { enabled: true, delay: 5, escalateTo: ['admin'] } },
      'PAUSED': { level: 'MEDIUM', escalation: { enabled: false, delay: 0, escalateTo: [] } }
    };
    return priorities[status] || priorities['STARTED'];
  }

  // Content generation methods
  private generateAttendanceSubject(data: AttendanceNotificationData): string {
    return `Attendance ${data.status} - ${data.sessionId}`;
  }

  private generateAttendanceContent(data: AttendanceNotificationData, language: string): string {
    const templates: Record<string, Record<string, string>> = {
      en: {
        PRESENT: `Your attendance has been recorded as PRESENT for session ${data.sessionId}.`,
        ABSENT: `You were marked as ABSENT for session ${data.sessionId}.`,
        LATE: `Your attendance has been recorded as LATE for session ${data.sessionId}.`,
        EXCUSED: `Your absence has been excused for session ${data.sessionId}.`
      }
    };

    const template = templates[language] || templates.en;
    return template[data.status] || `Attendance ${data.status} for session ${data.sessionId}.`;
  }

  private generateFraudAlertSubject(data: FraudAlertNotificationData): string {
    return `Security Alert: ${data.type} - ${data.severity}`;
  }

  private generateFraudAlertContent(data: FraudAlertNotificationData, language: string): string {
    return `Security Alert: ${data.description}\nType: ${data.type}\nSeverity: ${data.severity}\nRisk Score: ${data.riskScore}\nTimestamp: ${data.timestamp.toISOString()}`;
  }

  private generateLocationVerificationSubject(data: LocationVerificationNotificationData): string {
    return `Location Verification ${data.status}`;
  }

  private generateLocationVerificationContent(data: LocationVerificationNotificationData, language: string): string {
    return `Location verification ${data.status.toLowerCase()} for session ${data.sessionId}.\nDistance: ${data.distance}m\nAccuracy: ${data.location.accuracy}m`;
  }

  private generateSessionStatusSubject(data: SessionStatusNotificationData): string {
    return `Session ${data.status}: ${data.sessionId}`;
  }

  private generateSessionStatusContent(data: SessionStatusNotificationData, language: string): string {
    return `Session ${data.sessionId} has been ${data.status.toLowerCase()}.\nParticipants: ${data.participants}\nTimestamp: ${data.timestamp.toISOString()}`;
  }

  private generateEmergencySubject(data: EmergencyNotificationData): string {
    return `EMERGENCY: ${data.type} - ${data.severity}`;
  }

  private generateEmergencyContent(data: EmergencyNotificationData, language: string): string {
    return `EMERGENCY NOTIFICATION\nType: ${data.type}\nSeverity: ${data.severity}\nMessage: ${data.message}\nInstructions: ${data.instructions.join('\n')}\nContact: ${data.contactInfo.phone}`;
  }

  private generateSecurityWarningSubject(data: SecurityWarningNotificationData): string {
    return `Security Warning: ${data.type}`;
  }

  private generateSecurityWarningContent(data: SecurityWarningNotificationData, language: string): string {
    return `Security Warning: ${data.description}\nType: ${data.type}\nSeverity: ${data.severity}\nRecommendations: ${data.recommendations.join('\n')}`;
  }

  /**
   * Log info message
   */
  private logInfo(message: string, data?: any): void {
    console.log(`[AttendanceNotifications] ${message}`, data || '');
  }

  /**
   * Log error message
   */
  private logError(message: string, error: any, data?: any): void {
    console.error(`[AttendanceNotifications] ${message}`, error, data || '');
  }
}
