import {
  NotificationMessage,
  NotificationUser,
  NotificationType,
  NotificationStatus,
  NotificationDelivery,
  PushNotificationService,
  PushDelivery,
  NotificationRetryConfig,
  NotificationRateLimit,
  DeliveryStatus
} from './types';
import * as webpush from 'web-push';

/**
 * Push Notifications Service
 * Handles mobile and web push notifications with scheduling and priority-based delivery
 */
export class PushNotificationsService implements PushNotificationService {
  private retryConfig: NotificationRetryConfig;
  private rateLimit: NotificationRateLimit;
  private pushQueue: NotificationMessage[] = [];
  private deliveryHistory: Map<string, PushDelivery[]> = new Map();
  private subscriptions: Map<number, PushSubscription> = new Map();
  private pushConfig: PushConfig;
  private webPush: any; // Web push library instance

  constructor(
    retryConfig: NotificationRetryConfig,
    rateLimit: NotificationRateLimit,
    pushConfig: PushConfig
  ) {
    this.retryConfig = retryConfig;
    this.rateLimit = rateLimit;
    this.pushConfig = pushConfig;
    this.initializeWebPush();
    this.startPushProcessor();
  }

  /**
   * Send push notification
   */
  public async sendPushNotification(
    to: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<PushDelivery> {
    try {
      // Check rate limits
      if (this.rateLimit.enabled && !this.checkRateLimit(to)) {
        throw new Error('Rate limit exceeded for push notifications');
      }

      // Create push message
      const pushMessage = this.createPushMessage(to, title, body, data);

      // Add to queue
      this.pushQueue.push(pushMessage);

      // Process immediately for high priority notifications
      if (pushMessage.priority?.level === 'HIGH' || pushMessage.priority?.level === 'CRITICAL') {
        return this.processPush(pushMessage);
      }

      return this.createPushDelivery(pushMessage);
    } catch (error) {
      this.logError('Failed to send push notification', error, { to, title });
      throw error;
    }
  }

  /**
   * Subscribe user to push notifications
   */
  public async subscribeUser(userId: number, subscription: any): Promise<void> {
    try {
      // Validate subscription
      if (!this.validateSubscription(subscription)) {
        throw new Error('Invalid push subscription');
      }

      // Store subscription
      this.subscriptions.set(userId, subscription);

      // In a real implementation, you would store this in a database
      this.logInfo('User subscribed to push notifications', { userId });
    } catch (error) {
      this.logError('Failed to subscribe user', error, { userId });
      throw error;
    }
  }

  /**
   * Unsubscribe user from push notifications
   */
  public async unsubscribeUser(userId: number): Promise<void> {
    try {
      this.subscriptions.delete(userId);
      this.logInfo('User unsubscribed from push notifications', { userId });
    } catch (error) {
      this.logError('Failed to unsubscribe user', error, { userId });
      throw error;
    }
  }

  /**
   * Get push notification status
   */
  public async getPushStatus(messageId: string): Promise<PushDelivery> {
    const history = this.deliveryHistory.get(messageId) || [];
    return history[history.length - 1] || this.createPushDelivery({} as NotificationMessage);
  }

  /**
   * Send notification (implements NotificationService interface)
   */
  public async send(message: NotificationMessage): Promise<NotificationDelivery> {
    const pushDelivery = await this.sendPushNotification(
      message.recipient.email, // Using email as identifier for simplicity
      message.subject || 'Notification',
      message.content,
      message.data
    );

    return {
      id: pushDelivery.id,
      messageId: message.id,
      channel: { type: 'PUSH', enabled: true, priority: message.priority },
      status: pushDelivery.status,
      attemptNumber: 1,
      attemptedAt: pushDelivery.sentAt,
      deliveredAt: pushDelivery.deliveredAt,
      failedAt: pushDelivery.failedAt,
      errorMessage: pushDelivery.errorMessage,
      response: pushDelivery.response,
      metadata: {}
    };
  }

  /**
   * Send batch of notifications
   */
  public async sendBatch(messages: NotificationMessage[]): Promise<any> {
    const results: PushDelivery[] = [];

    for (const message of messages) {
      try {
        const delivery = await this.send(message);
        results.push(delivery as unknown as PushDelivery);
      } catch (error) {
        this.logError('Batch push failed', error, { messageId: message.id });
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
    this.pushQueue.push(message);
    this.logInfo('Push notification scheduled', { messageId: message.id, scheduledAt });
  }

  /**
   * Cancel notification
   */
  public async cancel(messageId: string): Promise<void> {
    const message = this.pushQueue.find(m => m.id === messageId);
    if (message) {
      message.status = NotificationStatus.CANCELLED;
      message.updatedAt = new Date();
      this.logInfo('Push notification cancelled', { messageId });
    }
  }

  /**
   * Get notification status
   */
  public async getStatus(messageId: string): Promise<NotificationStatus> {
    const message = this.pushQueue.find(m => m.id === messageId);
    return message ? message.status : NotificationStatus.PENDING;
  }

  /**
   * Get delivery history for a message
   */
  public async getDeliveryHistory(messageId: string): Promise<NotificationDelivery[]> {
    return (this.deliveryHistory.get(messageId) || []) as unknown as NotificationDelivery[];
  }

  /**
   * Process push notification from queue
   */
  private async processPush(message: NotificationMessage): Promise<PushDelivery> {
    const delivery = this.createPushDelivery(message);

    try {
      message.status = NotificationStatus.SENDING;
      message.deliveryAttempts++;
      message.updatedAt = new Date();

      // Send push notification
      await this.sendPushToDevice(message, delivery);

      message.status = NotificationStatus.DELIVERED;
      message.deliveredAt = new Date();
      message.updatedAt = new Date();

      delivery.status = DeliveryStatus.DELIVERED;
      delivery.deliveredAt = new Date();

      this.logInfo('Push notification delivered successfully', { messageId: message.id });
    } catch (error) {
      message.status = NotificationStatus.FAILED;
      message.failedAt = new Date();
      message.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      message.updatedAt = new Date();

      delivery.status = DeliveryStatus.FAILED;
      delivery.failedAt = new Date();
      delivery.errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logError('Push notification delivery failed', error, { messageId: message.id });
    }

    // Store delivery record
    const history = this.deliveryHistory.get(message.id) || [];
    history.push(delivery);
    this.deliveryHistory.set(message.id, history);

    return delivery;
  }

  /**
   * Send push notification to device
   */
  private async sendPushToDevice(message: NotificationMessage, delivery: PushDelivery): Promise<void> {
    try {
      const subscription = this.subscriptions.get(message.recipient.id);
      if (!subscription) {
        throw new Error('No push subscription found for user');
      }

      // Prepare push payload
      const payload = this.createPushPayload(message);

      // Send via web push
      const result = await this.webPush.sendNotification(subscription, JSON.stringify(payload), {
        TTL: this.pushConfig.ttl,
        urgency: this.getUrgencyLevel(message.priority.level),
        topic: this.pushConfig.topic
      });

      delivery.response = result;
      this.logInfo('Push notification sent', {
        messageId: message.id,
        userId: message.recipient.id,
        result: result
      });
    } catch (error) {
      throw new Error(`Push delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create push payload
   */
  private createPushPayload(message: NotificationMessage): PushPayload {
    return {
      title: message.subject || 'Notification',
      body: message.content,
      icon: this.pushConfig.icon,
      badge: this.pushConfig.badge,
      image: this.pushConfig.image,
      data: {
        ...message.data,
        messageId: message.id,
        type: message.type,
        category: message.category,
        priority: message.priority.level,
        timestamp: message.createdAt.toISOString()
      },
      actions: this.getNotificationActions(message.type),
      requireInteraction: message.priority.level === 'CRITICAL' || message.priority.level === 'EMERGENCY',
      silent: message.priority.level === 'LOW'
    };
  }

  /**
   * Get notification actions based on type
   */
  private getNotificationActions(type: NotificationType): PushAction[] {
    const actionMap: Record<NotificationType, PushAction[]> = {
      [NotificationType.ATTENDANCE]: [
        { action: 'view', title: 'View Details' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      [NotificationType.FRAUD_ALERT]: [
        { action: 'review', title: 'Review Alert' },
        { action: 'contact', title: 'Contact Support' }
      ],
      [NotificationType.LOCATION_VERIFICATION]: [
        { action: 'verify', title: 'Verify Location' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      [NotificationType.SESSION_STATUS]: [
        { action: 'view', title: 'View Session' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      [NotificationType.EMERGENCY]: [
        { action: 'acknowledge', title: 'Acknowledge' },
        { action: 'contact', title: 'Contact Emergency' }
      ],
      [NotificationType.SECURITY_WARNING]: [
        { action: 'review', title: 'Review Warning' },
        { action: 'secure', title: 'Secure Account' }
      ],
      [NotificationType.SYSTEM_MAINTENANCE]: [
        { action: 'view', title: 'View Details' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      [NotificationType.REPORT]: [
        { action: 'view', title: 'View Report' },
        { action: 'download', title: 'Download' }
      ],
      [NotificationType.REMINDER]: [
        { action: 'view', title: 'View Reminder' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      [NotificationType.CONFIRMATION]: [
        { action: 'view', title: 'View Confirmation' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    return actionMap[type] || [];
  }

  /**
   * Get urgency level for push notification
   */
  private getUrgencyLevel(priority: string): 'very-low' | 'low' | 'normal' | 'high' {
    const urgencyMap: Record<string, 'very-low' | 'low' | 'normal' | 'high'> = {
      'LOW': 'low',
      'MEDIUM': 'normal',
      'HIGH': 'high',
      'CRITICAL': 'high',
      'EMERGENCY': 'high'
    };
    return urgencyMap[priority] || 'normal';
  }

  /**
   * Validate push subscription
   */
  private validateSubscription(subscription: PushSubscription): boolean {
    return !!(subscription && subscription.endpoint && subscription.keys);
  }

  /**
   * Create push message
   */
  private createPushMessage(
    to: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): NotificationMessage {
    return {
      id: this.generateMessageId(),
      type: NotificationType.ATTENDANCE,
      category: 'push',
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
      subject: title,
      content: body,
      data,
      channels: [{ type: 'PUSH', enabled: true, priority: { level: 'MEDIUM', escalation: { enabled: false, delay: 0, escalateTo: [] } } }],
      status: NotificationStatus.PENDING,
      deliveryAttempts: 0,
      maxRetries: this.retryConfig.maxAttempts,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Create push delivery record
   */
  private createPushDelivery(message: NotificationMessage): PushDelivery {
    return {
      id: this.generateDeliveryId(),
      messageId: message.id,
      to: message.recipient.email,
      status: DeliveryStatus.PENDING,
      sentAt: new Date()
    };
  }

  /**
   * Initialize web push library
   */
  private initializeWebPush(): void {
    try {
      // Initialize web-push library
      webpush.setVapidDetails(
        this.pushConfig.vapid.subject,
        this.pushConfig.vapid.publicKey,
        this.pushConfig.vapid.privateKey
      );
      this.webPush = webpush;

      this.logInfo('Web push initialized', { vapidSubject: this.pushConfig.vapid.subject });
    } catch (error) {
      this.logError('Failed to initialize web push', error);
      throw error;
    }
  }

  /**
   * Check rate limits
   */
  private checkRateLimit(identifier: string): boolean {
    // Simplified rate limit check
    // In a real implementation, you would check against a rate limit store
    return true;
  }

  /**
   * Start push processor
   */
  private startPushProcessor(): void {
    setInterval(() => {
      this.processPushQueue();
    }, 2000); // Process every 2 seconds
  }

  /**
   * Process push queue
   */
  private async processPushQueue(): Promise<void> {
    const pendingPushes = this.pushQueue.filter(
      m => m.status === NotificationStatus.PENDING &&
        (!m.scheduledAt || m.scheduledAt <= new Date())
    );

    for (const push of pendingPushes.slice(0, 10)) { // Process up to 10 pushes at a time
      try {
        await this.processPush(push);
      } catch (error) {
        this.logError('Push processing failed', error, { messageId: push.id });
      }
    }
  }

  /**
   * Generate message ID
   */
  private generateMessageId(): string {
    return `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    console.log(`[PushNotifications] ${message}`, data || '');
  }

  /**
   * Log error message
   */
  private logError(message: string, error: any, data?: any): void {
    console.error(`[PushNotifications] ${message}`, error, data || '');
  }
}

/**
 * Push Configuration
 */
interface PushConfig {
  vapid: {
    subject: string;
    publicKey: string;
    privateKey: string;
  };
  ttl: number;
  topic?: string;
  icon?: string;
  badge?: string;
  image?: string;
}

/**
 * Push Subscription Interface
 */
interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Push Payload Interface
 */
interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, any>;
  actions?: PushAction[];
  requireInteraction?: boolean;
  silent?: boolean;
}

/**
 * Push Action Interface
 */
interface PushAction {
  action: string;
  title: string;
  icon?: string;
}
