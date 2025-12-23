// Notification System Types

export interface NotificationUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  preferences: UserNotificationPreferences;
  timezone: string;
  language: string;
}

export interface UserNotificationPreferences {
  email: {
    enabled: boolean;
    frequency: 'IMMEDIATE' | 'DAILY' | 'WEEKLY' | 'NEVER';
    categories: NotificationCategory[];
    quietHours: {
      enabled: boolean;
      start: string; // HH:MM format
      end: string; // HH:MM format
    };
  };
  push: {
    enabled: boolean;
    categories: NotificationCategory[];
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
  sms: {
    enabled: boolean;
    emergencyOnly: boolean;
  };
}

export interface NotificationCategory {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: NotificationPriority;
  channels: NotificationChannel[];
}

export interface NotificationChannel {
  type: 'EMAIL' | 'PUSH' | 'SMS' | 'IN_APP' | 'WEBHOOK';
  enabled: boolean;
  priority: NotificationPriority;
  template?: string;
  webhookUrl?: string;
}

export interface NotificationPriority {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'EMERGENCY';
  escalation: {
    enabled: boolean;
    delay: number; // minutes
    escalateTo: string[];
  };
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  category: string;
  language: string;
  version: string;
  subject?: string;
  content: string;
  variables: TemplateVariable[];
  metadata: {
    created: Date;
    updated: Date;
    author: string;
    tags: string[];
  };
}

export interface TemplateVariable {
  name: string;
  type: 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'OBJECT';
  required: boolean;
  defaultValue?: any;
  description: string;
}

export interface NotificationMessage {
  id: string;
  type: NotificationType;
  category: string;
  priority: NotificationPriority;
  recipient: NotificationUser;
  subject?: string;
  content: string;
  data?: Record<string, any>;
  scheduledAt?: Date;
  expiresAt?: Date;
  channels: NotificationChannel[];
  status: NotificationStatus;
  deliveryAttempts: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
}

export interface NotificationDelivery {
  id: string;
  messageId: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  attemptNumber: number;
  attemptedAt: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
  response?: any;
  metadata: Record<string, any>;
}

export interface NotificationBatch {
  id: string;
  name: string;
  messages: NotificationMessage[];
  status: BatchStatus;
  scheduledAt?: Date;
  createdAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
}

export interface NotificationAnalytics {
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    deliveryRate: number;
    averageDeliveryTime: number;
    channelBreakdown: Record<string, number>;
    categoryBreakdown: Record<string, number>;
    priorityBreakdown: Record<string, number>;
  };
  trends: {
    deliveryTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
    failureTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
  };
  topErrors: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
}

export interface NotificationSettings {
  retry: {
    maxAttempts: number;
    backoffStrategy: 'LINEAR' | 'EXPONENTIAL' | 'FIXED';
    initialDelay: number; // milliseconds
    maxDelay: number; // milliseconds
  };
  rateLimit: {
    enabled: boolean;
    maxPerMinute: number;
    maxPerHour: number;
    maxPerDay: number;
  };
  batching: {
    enabled: boolean;
    maxBatchSize: number;
    batchDelay: number; // milliseconds
  };
  cleanup: {
    enabled: boolean;
    retentionDays: number;
    archiveBeforeDelete: boolean;
  };
}

export interface NotificationWebhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  retryPolicy: {
    maxAttempts: number;
    timeout: number;
  };
  headers: Record<string, string>;
}

export interface NotificationSchedule {
  id: string;
  name: string;
  cron: string;
  template: string;
  recipients: string[];
  variables: Record<string, any>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

// Enums
export enum NotificationType {
  ATTENDANCE = 'ATTENDANCE',
  FRAUD_ALERT = 'FRAUD_ALERT',
  LOCATION_VERIFICATION = 'LOCATION_VERIFICATION',
  SESSION_STATUS = 'SESSION_STATUS',
  EMERGENCY = 'EMERGENCY',
  SECURITY_WARNING = 'SECURITY_WARNING',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  REPORT = 'REPORT',
  REMINDER = 'REMINDER',
  CONFIRMATION = 'CONFIRMATION'
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  SENDING = 'SENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export enum DeliveryStatus {
  PENDING = 'PENDING',
  SENDING = 'SENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  BOUNCED = 'BOUNCED',
  REJECTED = 'REJECTED'
}

export enum BatchStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum NotificationChannelType {
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
  WEBHOOK = 'WEBHOOK'
}

export enum NotificationPriorityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  EMERGENCY = 'EMERGENCY'
}

// Specific notification types
export interface AttendanceNotificationData {
  studentId: number;
  courseId: number;
  sessionId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  timestamp: Date;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  deviceInfo?: {
    fingerprint: string;
    userAgent: string;
  };
}

export interface FraudAlertNotificationData {
  alertId: string;
  studentId: number;
  type: string;
  severity: string;
  description: string;
  timestamp: Date;
  location?: {
    latitude: number;
    longitude: number;
  };
  riskScore: number;
  actions: string[];
}

export interface LocationVerificationNotificationData {
  studentId: number;
  sessionId: string;
  status: 'VERIFIED' | 'FAILED' | 'PENDING';
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  distance: number;
  timestamp: Date;
}

export interface SessionStatusNotificationData {
  sessionId: string;
  courseId: number;
  status: 'STARTED' | 'ENDED' | 'CANCELLED' | 'PAUSED';
  timestamp: Date;
  participants: number;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface EmergencyNotificationData {
  type: 'SECURITY_BREACH' | 'SYSTEM_FAILURE' | 'NATURAL_DISASTER' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  affectedUsers: number[];
  timestamp: Date;
  instructions: string[];
  contactInfo: {
    phone: string;
    email: string;
    emergency: string;
  };
}

export interface SecurityWarningNotificationData {
  type: 'SUSPICIOUS_ACTIVITY' | 'MULTIPLE_FAILED_ATTEMPTS' | 'DEVICE_CHANGE' | 'LOCATION_ANOMALY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  timestamp: Date;
  affectedUser: number;
  recommendations: string[];
  actions: string[];
}

export interface ReportNotificationData {
  reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalSessions: number;
    totalStudents: number;
    attendanceRate: number;
    fraudDetected: number;
  };
  attachments: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
}

// Notification service interfaces
export interface NotificationService {
  send(message: NotificationMessage): Promise<NotificationDelivery>;
  sendBatch(messages: NotificationMessage[]): Promise<NotificationBatch>;
  schedule(message: NotificationMessage, scheduledAt: Date): Promise<void>;
  cancel(messageId: string): Promise<void>;
  getStatus(messageId: string): Promise<NotificationStatus>;
  getDeliveryHistory(messageId: string): Promise<NotificationDelivery[]>;
}

export interface EmailNotificationService extends NotificationService {
  sendEmail(to: string, subject: string, content: string, options?: EmailOptions): Promise<EmailDelivery>;
  sendTemplateEmail(to: string, templateId: string, variables: Record<string, any>): Promise<EmailDelivery>;
  validateEmailAddress(email: string): Promise<boolean>;
  getEmailStatus(messageId: string): Promise<EmailDelivery>;
}

export interface PushNotificationService extends NotificationService {
  sendPushNotification(to: string, title: string, body: string, data?: Record<string, any>): Promise<PushDelivery>;
  subscribeUser(userId: number, subscription: PushSubscription): Promise<void>;
  unsubscribeUser(userId: number): Promise<void>;
  getPushStatus(messageId: string): Promise<PushDelivery>;
}

export interface TemplateService {
  createTemplate(template: NotificationTemplate): Promise<NotificationTemplate>;
  updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate>;
  deleteTemplate(templateId: string): Promise<void>;
  getTemplate(templateId: string): Promise<NotificationTemplate>;
  getTemplates(filters?: TemplateFilters): Promise<NotificationTemplate[]>;
  renderTemplate(templateId: string, variables: Record<string, any>): Promise<string>;
  validateTemplate(template: NotificationTemplate): Promise<TemplateValidationResult>;
}

export interface TemplateFilters {
  type?: NotificationType;
  category?: string;
  language?: string;
  tags?: string[];
}

export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  variables: TemplateVariable[];
}

export interface EmailOptions {
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
  disposition?: 'attachment' | 'inline';
  cid?: string;
}

export interface EmailDelivery {
  id: string;
  messageId: string;
  to: string;
  status: DeliveryStatus;
  sentAt: Date;
  deliveredAt?: Date;
  bouncedAt?: Date;
  errorMessage?: string;
  response?: any;
}

export interface PushDelivery {
  id: string;
  messageId: string;
  to: string;
  status: DeliveryStatus;
  sentAt: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
  response?: any;
}

export interface NotificationRetryConfig {
  maxAttempts: number;
  backoffStrategy: 'LINEAR' | 'EXPONENTIAL' | 'FIXED';
  initialDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}

export interface NotificationRateLimit {
  enabled: boolean;
  maxPerMinute: number;
  maxPerHour: number;
  maxPerDay: number;
  windowSize: number; // minutes
}

export interface NotificationAnalyticsConfig {
  enabled: boolean;
  retentionDays: number;
  metricsInterval: number; // minutes
  alertThresholds: {
    deliveryRate: number;
    failureRate: number;
    responseTime: number;
  };
}
