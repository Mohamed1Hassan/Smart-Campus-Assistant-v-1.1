import { NotificationConfig, NotificationPriorityLevel } from '../services/notifications/types';

export const notificationConfig: NotificationConfig = {
    retry: {
        maxAttempts: 3,
        backoffStrategy: 'EXPONENTIAL',
        initialDelay: 1000,
        maxDelay: 60000,
        retryableErrors: ['ECONNRESET', 'ETIMEDOUT']
    },
    rateLimit: {
        enabled: true,
        maxPerMinute: 60,
        maxPerHour: 1000,
        maxPerDay: 5000,
        windowSize: 60
    },
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || ''
        },
        from: process.env.SMTP_FROM || 'noreply@smartcampus.edu',
        replyTo: process.env.SMTP_REPLY_TO
    },
    push: {
        vapid: {
            subject: process.env.VAPID_SUBJECT || 'mailto:admin@smartcampus.edu',
            publicKey: process.env.VAPID_PUBLIC_KEY || '',
            privateKey: process.env.VAPID_PRIVATE_KEY || ''
        },
        ttl: 2419200
    },
    analytics: {
        enabled: true,
        retentionDays: 30,
        metricsInterval: 60,
        alertThresholds: {
            deliveryRate: 90,
            failureRate: 5,
            responseTime: 1000
        }
    }
};
