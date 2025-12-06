import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ProfessorSettingsController {
    /**
     * Get professor settings
     * GET /api/professor/settings
     */
    static async getSettings(req: any, res: Response): Promise<void> {
        try {
            const professorId = req.user?.id;

            if (!professorId) {
                res.status(401).json({
                    success: false,
                    message: 'Unauthorized'
                });
                return;
            }

            let settings = await prisma.professorSettings.findUnique({
                where: { professorId: parseInt(professorId) }
            });

            // If no settings exist, create default ones
            if (!settings) {
                try {
                    // Use upsert to be safe against race conditions
                    settings = await prisma.professorSettings.upsert({
                        where: { professorId: parseInt(professorId) },
                        update: {}, // No updates if exists
                        create: {
                            professorId: parseInt(professorId)
                        }
                    });
                } catch (createError) {
                    // If creation fails (e.g. unique constraint), try fetching again
                    settings = await prisma.professorSettings.findUnique({
                        where: { professorId: parseInt(professorId) }
                    });
                }
            }

            const structuredSettings = {
                security: {
                    defaultGracePeriod: settings?.defaultGracePeriod,
                    defaultMaxAttempts: settings?.defaultMaxAttempts,
                    defaultRiskThreshold: settings?.defaultRiskThreshold,
                },
                location: {
                    defaultRadius: settings?.defaultRadius,
                    enableGeofencing: settings?.enableGeofencing,
                    requireLocationAccuracy: settings?.requireLocationAccuracy,
                },
                device: {
                    enableDeviceFingerprinting: settings?.enableDeviceFingerprinting,
                    enableDeviceSharingDetection: settings?.enableDeviceSharingDetection,
                },
                photo: {
                    requirePhotoVerification: settings?.requirePhotoVerification,
                    enableFaceDetection: settings?.enableFaceDetection,
                },
                time: {
                    enableTimeValidation: settings?.enableTimeValidation,
                },
                notifications: {
                    enableEmailNotifications: settings?.enableEmailNotifications,
                    enablePushNotifications: settings?.enablePushNotifications,
                    notifyOnFraudDetection: settings?.notifyOnFraudDetection,
                },
                fraudDetection: {
                    // These might be derived or hardcoded if not in DB, but for now we map what we have
                    enableMLBasedDetection: true, // Assuming this is system-wide or not yet in schema? keeping as true for now
                    fraudDetectionThreshold: settings?.defaultRiskThreshold // Reusing risk threshold or adding new field
                }
            };

            res.status(200).json({
                success: true,
                data: structuredSettings
            });
        } catch (error: any) {
            console.error('Error getting professor settings:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve settings'
            });
        }
    }

    /**
     * Update professor settings
     * PUT /api/professor/settings
     */
    static async updateSettings(req: any, res: Response): Promise<void> {
        try {
            const professorId = req.user?.id;
            const {
                security,
                location,
                device,
                photo,
                time,
                notifications
            } = req.body;

            if (!professorId) {
                res.status(401).json({
                    success: false,
                    message: 'Unauthorized'
                });
                return;
            }

            // Flatten the structure to match database columns
            const updateData: any = {};

            if (security) {
                if (security.defaultGracePeriod !== undefined) updateData.defaultGracePeriod = security.defaultGracePeriod;
                if (security.defaultMaxAttempts !== undefined) updateData.defaultMaxAttempts = security.defaultMaxAttempts;
                if (security.defaultRiskThreshold !== undefined) updateData.defaultRiskThreshold = security.defaultRiskThreshold;
            }

            if (location) {
                if (location.defaultRadius !== undefined) updateData.defaultRadius = location.defaultRadius;
                if (location.enableGeofencing !== undefined) updateData.enableGeofencing = location.enableGeofencing;
                if (location.requireLocationAccuracy !== undefined) updateData.requireLocationAccuracy = location.requireLocationAccuracy;
            }

            if (device) {
                if (device.enableDeviceFingerprinting !== undefined) updateData.enableDeviceFingerprinting = device.enableDeviceFingerprinting;
                if (device.enableDeviceSharingDetection !== undefined) updateData.enableDeviceSharingDetection = device.enableDeviceSharingDetection;
            }

            if (photo) {
                if (photo.requirePhotoVerification !== undefined) updateData.requirePhotoVerification = photo.requirePhotoVerification;
                if (photo.enableFaceDetection !== undefined) updateData.enableFaceDetection = photo.enableFaceDetection;
            }

            if (time) {
                if (time.enableTimeValidation !== undefined) updateData.enableTimeValidation = time.enableTimeValidation;
            }

            if (notifications) {
                if (notifications.enableEmailNotifications !== undefined) updateData.enableEmailNotifications = notifications.enableEmailNotifications;
                if (notifications.enablePushNotifications !== undefined) updateData.enablePushNotifications = notifications.enablePushNotifications;
                if (notifications.notifyOnFraudDetection !== undefined) updateData.notifyOnFraudDetection = notifications.notifyOnFraudDetection;
            }

            const settings = await prisma.professorSettings.upsert({
                where: { professorId: parseInt(professorId) },
                update: updateData,
                create: {
                    professorId: parseInt(professorId),
                    ...updateData
                }
            });

            res.status(200).json({
                success: true,
                message: 'Settings updated successfully',
                data: settings
            });
        } catch (error: any) {
            console.error('Error updating professor settings:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update settings'
            });
        }
    }
}
