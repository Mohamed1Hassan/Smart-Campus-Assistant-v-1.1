import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

// Types
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

// Initialize Prisma client
import prisma from '../../config/database.js';

// Validation schemas
const createSessionSchema = z.object({
  courseId: z.number().positive(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radius: z.number().positive(),
    name: z.string().min(1)
  }).optional(),
  securitySettings: z.object({
    requireLocation: z.boolean(),
    requirePhoto: z.boolean(),
    requireDeviceCheck: z.boolean(),
    enableFraudDetection: z.boolean(),
    maxAttempts: z.number().positive(),
    gracePeriod: z.number().nonnegative()
  })
});

const scanQRCodeSchema = z.object({
  sessionId: z.string().uuid(),
  qrCode: z.string().min(1),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().positive()
  }).optional(),
  deviceFingerprint: z.string().optional(),
  photo: z.string().optional()
});

const markAttendanceSchema = z.object({
  sessionId: z.string().uuid(),
  studentId: z.string().optional(), // Can be provided or inferred from token
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  notes: z.string().optional()
});

// Utility functions
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const generateQRCode = (sessionId: string): string => {
  return `attendance-${sessionId}-${Date.now()}`;
};

const calculateFraudScore = (data: any): number => {
  let score = 0;

  // Location fraud detection
  if (data.location && data.sessionLocation) {
    const distance = calculateDistance(
      data.location.latitude,
      data.location.longitude,
      data.sessionLocation.latitude,
      data.sessionLocation.longitude
    );

    if (distance > data.sessionLocation.radius) {
      score += 50;
    }
  }

  // Device fraud detection
  if (data.deviceFingerprint) {
    if (!data.registeredDevices.includes(data.deviceFingerprint)) {
      score += 30;
    }
  }

  // Time fraud detection
  const now = new Date();
  const sessionStart = new Date(data.sessionStartTime);
  const sessionEnd = new Date(data.sessionEndTime);

  if (now < sessionStart || now > sessionEnd) {
    score += 40;
  }

  return Math.min(100, score);
};

const logActivity = async (userId: string, action: string, details: any) => {
  try {
    await prisma.activityLog.create({
      data: {
        id: uuidv4(),
        userId,
        action,
        details,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

const sendNotification = async (userId: string, type: string, message: string, data?: any) => {
  try {
    await prisma.notification.create({
      data: {
        userId: parseInt(userId),
        type: type as any,
        title: 'Notification',
        category: 'SYSTEM' as any,
        message,
        metadata: data || {},
        isRead: false,
        createdAt: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
};

// Session Management Controllers

export const createSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sessionData = createSessionSchema.parse(req.body);
    const professorId = parseInt(req.user!.id);

    // Verify course exists and user has access
    const course = await prisma.course.findFirst({
      where: {
        id: sessionData.courseId,
        professorId: professorId
      }
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found or access denied'
      });
    }

    // Validate time constraints
    const startTime = new Date(sessionData.startTime);
    const endTime = new Date(sessionData.endTime);

    if (startTime >= endTime) {
      return res.status(400).json({
        success: false,
        error: 'Start time must be before end time'
      });
    }

    if (startTime <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Start time must be in the future'
      });
    }

    // Create session with transaction
    const session = await prisma.$transaction(async (tx) => {
      const newSession = await tx.attendanceSession.create({
        data: {
          // id field is auto-generated uuid
          courseId: sessionData.courseId,
          professorId: professorId,
          title: sessionData.title,
          description: sessionData.description,
          startTime,
          endTime,
          location: sessionData.location ? sessionData.location as any : undefined, // Cast to any to avoid Json type issues
          securitySettings: sessionData.securitySettings ? sessionData.securitySettings as any : undefined,
          status: 'SCHEDULED',
          qrCode: generateQRCode(uuidv4()),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'CREATE_SESSION',
          details: { sessionId: newSession.id, courseId: newSession.courseId },
          timestamp: new Date()
        }
      });

      return newSession;
    });

    res.status(201).json({
      success: true,
      data: session,
      message: 'Session created successfully'
    });
  } catch (error) {
    console.error('Create session error:', error);
    next(error);
  }
};

export const getSessions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: any = {};

    // Filter by user role
    const userId = parseInt(req.user!.id);
    if (req.user!.role === 'PROFESSOR') {
      where.professorId = userId;
    } else if (req.user!.role === 'STUDENT') {
      where.course = {
        enrollments: {
          some: {
            studentId: userId
          }
        }
      };
    }

    // Apply filters
    if (req.query.status) {
      where.status = req.query.status;
    }

    if (req.query.courseId) {
      where.courseId = parseInt(req.query.courseId as string);
    }

    if (req.query.startDate) {
      where.startTime = {
        gte: new Date(req.query.startDate as string)
      };
    }

    if (req.query.endDate) {
      where.endTime = {
        lte: new Date(req.query.endDate as string)
      };
    }

    const [sessions, total] = await Promise.all([
      prisma.attendanceSession.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          course: {
            select: {
              courseName: true,
              courseCode: true
            }
          }
        }
      }),
      prisma.attendanceSession.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    next(error);
  }
};

export const getSessionDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    const userId = parseInt(req.user!.id);

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        course: {
          select: {
            id: true,
            courseName: true,
            courseCode: true,
            description: true
          }
        },
        attendanceRecords: {
          include: {
            student: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            attendanceRecords: true
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Check access permissions
    if (req.user!.role === 'PROFESSOR' && session.professorId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Get session details error:', error);
    next(error);
  }
};

export const updateSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    const userId = parseInt(req.user!.id);

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (session.professorId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const sessionData = createSessionSchema.partial().parse(req.body);

    const updatedSession = await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        ...sessionData,
        courseId: undefined, // Cannot update courseId
        startTime: sessionData.startTime ? new Date(sessionData.startTime) : undefined,
        endTime: sessionData.endTime ? new Date(sessionData.endTime) : undefined,
        location: sessionData.location ? sessionData.location as any : undefined,
        securitySettings: sessionData.securitySettings ? sessionData.securitySettings as any : undefined,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      data: updatedSession
    });
  } catch (error) {
    console.error('Update session error:', error);
    next(error);
  }
};
export const deleteSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    const userId = parseInt(req.user!.id);

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (session.professorId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (session.status === 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete active session'
      });
    }

    await prisma.$transaction(async (tx) => {
      // Delete related records
      await tx.attendanceRecord.deleteMany({
        where: { sessionId }
      });

      await tx.fraudAlert.deleteMany({
        where: { sessionId }
      });

      await tx.attendanceSession.delete({
        where: { id: sessionId }
      });
    });

    // Log activity
    await logActivity(req.user!.id, 'SESSION_DELETED', {
      sessionId,
      title: session.title
    });

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('Delete session error:', error);
    next(error);
  }
};

export const startSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (session.professorId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (session.status !== 'SCHEDULED' && session.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: 'Session is not in scheduled or draft status'
      });
    }

    const updatedSession = await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        status: 'ACTIVE',
        updatedAt: new Date()
      }
    });

    // Log activity
    await logActivity(req.user!.id, 'SESSION_STARTED', {
      sessionId,
      title: session.title
    });

    res.json({
      success: true,
      data: updatedSession,
      message: 'Session started successfully'
    });
  } catch (error) {
    console.error('Start session error:', error);
    next(error);
  }
};

export const stopSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    const userId = parseInt(req.user!.id);

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (session.professorId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (session.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Session is not active'
      });
    }

    const updatedSession = await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        updatedAt: new Date()
      }
    });

    // Log activity
    await logActivity(req.user!.id, 'SESSION_STOPPED', {
      sessionId,
      title: session.title
    });

    res.json({
      success: true,
      data: updatedSession,
      message: 'Session stopped successfully'
    });
  } catch (error) {
    console.error('Stop session error:', error);
    next(error);
  }
};

// Attendance Processing Controllers

export const scanQRCode = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId, qrCode, location, deviceFingerprint } = scanQRCodeSchema.parse(req.body);
    const userId = parseInt(req.user!.id);

    // Verify session exists and is active
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        course: {
          include: {
            enrollments: {
              where: {
                studentId: userId
              }
            }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (session.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Session is not active'
      });
    }

    // Verify QR code
    if (session.qrCode !== qrCode) {
      return res.status(400).json({
        success: false,
        error: 'Invalid QR code'
      });
    }

    // Check if student is enrolled in course
    const isEnrolled = session.course.enrollments.length > 0;

    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        error: 'Student not enrolled in course'
      });
    }

    // Check for existing records
    const existingRecord = await prisma.attendanceRecord.findFirst({
      where: {
        sessionId,
        studentId: userId
      }
    });

    // Device verification
    let deviceVerified = false;
    if (session.securitySettings && (session.securitySettings as any).requireDeviceCheck && deviceFingerprint) {
      const device = await prisma.deviceFingerprint.findFirst({
        where: {
          fingerprint: deviceFingerprint,
          studentId: userId,
          isActive: true
        }
      });

      if (!device) {
        return res.status(400).json({
          success: false,
          error: 'Device verification failed',
          details: 'Device not registered'
        });
      }
      deviceVerified = true;
    }

    // Location verification
    let locationVerified = false;
    if (session.securitySettings && (session.securitySettings as any).requireLocation && location && session.location) {
      const sessionLoc = session.location as any;
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        sessionLoc.latitude,
        sessionLoc.longitude
      );

      if (distance > sessionLoc.radius) {
        return res.status(400).json({
          success: false,
          error: 'Location verification failed',
          details: 'You are outside the allowed area'
        });
      }
      locationVerified = true;
    }

    // Get registered devices for fraud calculation
    const registeredDevices = await prisma.deviceFingerprint.findMany({
      where: {
        studentId: userId,
        isActive: true
      },
      select: {
        fingerprint: true,
        lastUsed: true
      }
    });

    // Calculate fraud score
    const fraudScore = calculateFraudScore({
      location,
      sessionLocation: session.location as any,
      deviceFingerprint,
      registeredDevices: registeredDevices.map(d => d.fingerprint),
      sessionStartTime: session.startTime,
      sessionEndTime: session.endTime
    });

    // Create fraud alert if score is high
    if (fraudScore > 70) {
      await prisma.fraudAlert.create({
        data: {
          studentId: userId,
          sessionId,
          alertType: 'FRAUD_DETECTED',
          severity: 'HIGH',
          description: `High fraud score detected: ${fraudScore}`,
          metadata: {
            fraudScore,
            location,
            deviceFingerprint
          },
          isResolved: false
        }
      });
    }

    let attendanceRecord;

    if (existingRecord) {
      // If already present or late, do not allow changes (return 409)
      if (existingRecord.status === 'PRESENT' || existingRecord.status === 'LATE') {
        return res.status(409).json({
          success: false,
          error: 'Attendance already marked'
        });
      }

      // If absent or failed, allow update to PRESENT
      attendanceRecord = await prisma.attendanceRecord.update({
        where: { id: existingRecord.id },
        data: {
          status: 'PRESENT',
          markedAt: new Date(),
          location: location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy
          } : undefined,
          deviceFingerprint,
          fraudScore,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new record
      attendanceRecord = await prisma.attendanceRecord.create({
        data: {
          sessionId,
          studentId: userId,
          markedAt: new Date(),
          status: 'PRESENT',
          location: location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy
          } : undefined,
          deviceFingerprint,
          fraudScore,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    // Log activity
    await logActivity(req.user!.id, existingRecord ? 'ATTENDANCE_UPDATED' : 'ATTENDANCE_MARKED', {
      sessionId,
      fraudScore,
      location,
      previousStatus: existingRecord?.status
    });

    res.json({
      success: true,
      data: attendanceRecord,
      message: existingRecord ? 'Attendance updated successfully' : 'Attendance marked successfully'
    });
  } catch (error) {
    console.error('Scan QR code error:', error);
    next(error);
  }
};

export const markAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId, studentId: studentIdStr, status, notes } = markAttendanceSchema.parse(req.body);
    const userId = parseInt(req.user!.id);
    const studentId = studentIdStr ? parseInt(studentIdStr) : userId;

    // Verify session exists and user has access
    const session = await prisma.attendanceSession.findFirst({
      where: {
        id: sessionId,
        professorId: userId
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or access denied'
      });
    }

    // Check if student is enrolled in course
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: {
        courseId: session.courseId,
        studentId
      }
    });

    if (!enrollment) {
      return res.status(400).json({
        success: false,
        error: 'Student not enrolled in course'
      });
    }

    // Check if record already exists
    const existingRecord = await prisma.attendanceRecord.findFirst({
      where: {
        sessionId,
        studentId
      }
    });

    if (existingRecord) {
      // Update existing record
      const updatedRecord = await prisma.attendanceRecord.update({
        where: { id: existingRecord.id },
        data: {
          status,
          notes,
          updatedAt: new Date()
        }
      });

      // Log activity
      await logActivity(req.user!.id, 'ATTENDANCE_UPDATED', {
        sessionId,
        studentId,
        status,
        notes
      });

      res.json({
        success: true,
        data: updatedRecord,
        message: 'Attendance record updated successfully'
      });
    } else {
      // Create new record
      const attendanceRecord = await prisma.attendanceRecord.create({
        data: {
          sessionId,
          studentId,
          markedAt: new Date(),
          status,
          notes,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Log activity
      await logActivity(req.user!.id, 'ATTENDANCE_MARKED_MANUAL', {
        sessionId,
        studentId,
        status,
        notes
      });

      res.status(201).json({
        success: true,
        data: attendanceRecord,
        message: 'Attendance record created successfully'
      });
    }
  } catch (error) {
    console.error('Mark attendance error:', error);
    next(error);
  }
};

export const getAttendanceStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.sessionId;

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        attendanceRecords: {
          include: {
            student: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        _count: {
          select: {
            attendanceRecords: true
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Check access permissions
    if (req.user!.role === 'PROFESSOR' && session.professorId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const status = {
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        location: session.location
      },
      attendance: {
        total: session._count.attendanceRecords,
        present: session.attendanceRecords.filter(r => r.status === 'PRESENT').length,
        absent: session.attendanceRecords.filter(r => r.status === 'ABSENT').length,
        late: session.attendanceRecords.filter(r => r.status === 'LATE').length,
        excused: session.attendanceRecords.filter(r => r.status === 'EXCUSED').length
      },
      records: session.attendanceRecords
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get attendance status error:', error);
    next(error);
  }
};

export const updateAttendanceRecord = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recordId = parseInt(req.params.id);

    const record = await prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: {
        session: {
          select: {
            professorId: true
          }
        }
      }
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }

    // Check access permissions
    if (req.user!.role === 'PROFESSOR' && record.session.professorId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (req.user!.role === 'STUDENT' && record.studentId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const updatedRecord = await prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        ...req.body,
        updatedAt: new Date()
      }
    });

    // Log activity
    await logActivity(req.user!.id, 'ATTENDANCE_RECORD_UPDATED', {
      recordId,
      changes: req.body
    });

    res.json({
      success: true,
      data: updatedRecord,
      message: 'Attendance record updated successfully'
    });
  } catch (error) {
    console.error('Update attendance record error:', error);
    next(error);
  }
};

// Security & Fraud Detection Controllers

export const verifyLocation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId, latitude, longitude, accuracy } = req.body;

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (!session.location) {
      return res.status(400).json({
        success: false,
        error: 'Session does not require location verification'
      });
    }

    const sessionLoc = session.location as any;
    const distance = calculateDistance(
      latitude,
      longitude,
      sessionLoc.latitude,
      sessionLoc.longitude
    );

    const isWithinRadius = distance <= sessionLoc.radius;
    const fraudScore = isWithinRadius ? 0 : Math.min(100, (distance / sessionLoc.radius) * 100);

    // Log location verification
    await logActivity(req.user!.id, 'LOCATION_VERIFIED', {
      sessionId,
      distance,
      isWithinRadius,
      fraudScore
    });

    res.json({
      success: true,
      data: {
        isWithinRadius,
        distance,
        requiredRadius: (session.location as any).radius,
        accuracy,
        fraudScore
      }
    });
  } catch (error) {
    console.error('Verify location error:', error);
    next(error);
  }
};

export const verifyDevice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { deviceFingerprint } = req.body;

    const device = await prisma.deviceFingerprint.findFirst({
      where: {
        fingerprint: deviceFingerprint,
        studentId: req.user!.id,
        isActive: true
      }
    });

    if (!device) {
      return res.status(400).json({
        success: false,
        error: 'Device verification failed',
        details: 'Device not registered or inactive'
      });
    }

    // Update last used timestamp
    await prisma.deviceFingerprint.update({
      where: { id: device.id },
      data: { lastUsed: new Date() }
    });

    // Log device verification
    await logActivity(req.user!.id, 'DEVICE_VERIFIED', {
      deviceId: device.id,
      fingerprint: deviceFingerprint
    });

    res.json({
      success: true,
      data: {
        isVerified: true,
        deviceInfo: device.deviceInfo,
        lastUsed: device.lastUsed,
        confidence: 95
      }
    });
  } catch (error) {
    console.error('Verify device error:', error);
    next(error);
  }
};

export const uploadPhoto = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Photo is required'
      });
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (!session.securitySettings.requirePhoto) {
      return res.status(400).json({
        success: false,
        error: 'Session does not require photo verification'
      });
    }

    // Process and optimize image
    const processedImage = await sharp(req.file.buffer)
      .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Generate unique filename
    const filename = `attendance-${sessionId}-${req.user!.id}-${Date.now()}.jpg`;

    // Note: Photo storage currently returns a mock URL
    // Future: Implement cloud storage (AWS S3, Azure Blob, Google Cloud Storage)
    // See BACKLOG.md for details
    const photoUrl = `https://storage.example.com/photos/${filename}`;

    // Note: Face detection currently returns mock values
    // Future: Integrate AWS Rekognition, Azure Face API, or similar
    // See BACKLOG.md for details
    const qualityScore = 85;
    const hasFace = true;

    // Log photo upload
    await logActivity(req.user!.id, 'PHOTO_UPLOADED', {
      sessionId,
      filename,
      qualityScore,
      hasFace
    });

    res.json({
      success: true,
      data: {
        photoUrl,
        qualityScore,
        hasFace,
        size: processedImage.length,
        format: 'JPEG'
      }
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    next(error);
  }
};

export const getFraudAlerts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: any = {};

    // Filter by user role
    if (req.user!.role === 'STUDENT') {
      where.studentId = req.user!.id;
    } else if (req.user!.role === 'PROFESSOR') {
      where.session = {
        professorId: req.user!.id
      };
    }

    // Apply filters
    if (req.query.severity) {
      where.severity = req.query.severity;
    }

    if (req.query.isResolved !== undefined) {
      where.isResolved = req.query.isResolved === 'true';
    }

    const [alerts, total] = await Promise.all([
      prisma.fraudAlert.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          session: {
            select: {
              id: true,
              title: true,
              courseId: true
            }
          }
        }
      }),
      prisma.fraudAlert.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        alerts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get fraud alerts error:', error);
    next(error);
  }
};

export const reportFraud = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId, alertType, severity, description, metadata } = req.body;

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const fraudAlert = await prisma.fraudAlert.create({
      data: {
        studentId: parseInt(req.user!.id),
        sessionId,
        alertType,
        severity,
        description,
        metadata: metadata || {},
        isResolved: false,
        createdAt: new Date()
      }
    });

    // Send notification to professor
    await sendNotification(session.professorId, 'FRAUD_ALERT',
      `New fraud alert reported: ${description}`, {
      alertId: fraudAlert.id,
      studentId: req.user!.id,
      sessionId
    });

    // Log fraud report
    await logActivity(req.user!.id, 'FRAUD_REPORTED', {
      sessionId,
      alertType,
      severity,
      alertId: fraudAlert.id
    });

    res.status(201).json({
      success: true,
      data: fraudAlert,
      message: 'Fraud alert reported successfully'
    });
  } catch (error) {
    console.error('Report fraud error:', error);
    next(error);
  }
};

export const resolveFraudAlert = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { resolution } = req.body;
    const alertId = parseInt(req.params.id);

    const alert = await prisma.fraudAlert.findUnique({
      where: { id: alertId }
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    const updatedAlert = await prisma.fraudAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: parseInt(req.user!.id),
        metadata: {
          ...alert.metadata,
          resolution
        }
      }
    });

    // Log resolution
    await logActivity(req.user!.id, 'FRAUD_ALERT_RESOLVED', {
      alertId,
      resolution
    });

    res.json({
      success: true,
      data: updatedAlert,
      message: 'Fraud alert resolved successfully'
    });
  } catch (error) {
    console.error('Resolve fraud alert error:', error);
    next(error);
  }
};

// Analytics & Reporting Controllers

export const getAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, courseId, groupBy = 'day' } = req.query;

    const where: any = {};

    // Filter by user role
    if (req.user!.role === 'PROFESSOR') {
      where.session = {
        professorId: req.user!.id
      };
    } else if (req.user!.role === 'STUDENT') {
      where.studentId = req.user!.id;
    }

    // Apply date filters
    if (startDate) {
      where.timestamp = {
        ...where.timestamp,
        gte: new Date(startDate as string)
      };
    }

    if (endDate) {
      where.timestamp = {
        ...where.timestamp,
        lte: new Date(endDate as string)
      };
    }

    // Apply course filter
    if (courseId) {
      where.session = {
        ...where.session,
        courseId: parseInt(courseId as string)
      };
    }

    // Get attendance records
    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        session: {
          select: {
            id: true,
            title: true,
            courseId: true
          }
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Calculate analytics
    const totalRecords = records.length;
    const presentCount = records.filter(r => r.status === 'PRESENT').length;
    const absentCount = records.filter(r => r.status === 'ABSENT').length;
    const lateCount = records.filter(r => r.status === 'LATE').length;
    const excusedCount = records.filter(r => r.status === 'EXCUSED').length;

    const attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;

    // Group by time period
    const groupedData = records.reduce((acc, record) => {
      const date = new Date(record.timestamp);
      let key: string;

      switch (groupBy) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      if (!acc[key]) {
        acc[key] = {
          date: key,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          attendanceRate: 0
        };
      }

      acc[key].total++;
      acc[key][record.status.toLowerCase()]++;
      acc[key].attendanceRate = (acc[key].present / acc[key].total) * 100;

      return acc;
    }, {} as any);

    const analytics = {
      summary: {
        totalRecords,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        attendanceRate: Math.round(attendanceRate * 100) / 100
      },
      trends: Object.values(groupedData),
      records: records.slice(0, 100) // Limit to first 100 records
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    next(error);
  }
};

export const getSecurityMetrics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;

    const where: any = {};

    // Filter by user role
    if (req.user!.role === 'PROFESSOR') {
      where.session = {
        professorId: req.user!.id
      };
    }

    // Apply date filters
    if (startDate) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(startDate as string)
      };
    }

    if (endDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(endDate as string)
      };
    }

    // Get security metrics
    const [totalSessions, totalAttendance, fraudAttempts, securityScore] = await Promise.all([
      prisma.attendanceSession.count({ where: { professorId: req.user!.id } }),
      prisma.attendanceRecord.count({ where }),
      prisma.fraudAlert.count({ where }),
      prisma.attendanceRecord.aggregate({
        where: {
          ...where,
          fraudScore: { not: null }
        },
        _avg: {
          fraudScore: true
        }
      })
    ]);

    const metrics: SecurityMetrics = {
      totalSessions,
      totalAttendance,
      fraudAttempts,
      securityScore: securityScore._avg.fraudScore ? Math.round(securityScore._avg.fraudScore * 100) / 100 : 0,
      riskLevel: securityScore._avg.fraudScore > 70 ? 'HIGH' : securityScore._avg.fraudScore > 40 ? 'MEDIUM' : 'LOW',
      trends: {
        // Note: Trend calculation not yet implemented
        // Future: Implement 7-day rolling average trend analysis
        // See BACKLOG.md for details
        attendance: [],
        fraud: [],
        security: []
      }
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Get security metrics error:', error);
    next(error);
  }
};

export const generateReports = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { type, format = 'json', startDate, endDate } = req.query;

    // Note: Report generation currently returns placeholder
    // Future: Implement PDF/Excel generation with charts
    // See BACKLOG.md for details
    const report = {
      type,
      format,
      generatedAt: new Date(),
      data: {
        message: 'Report generation not yet implemented'
      }
    };

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Generate reports error:', error);
    next(error);
  }
};

export const exportData = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { format } = req.params;
    const { startDate, endDate } = req.query;

    // Note: Data export currently returns placeholder
    // Future: Implement CSV/XLSX generation with exceljs
    // See BACKLOG.md for details
    const exportData = {
      format,
      generatedAt: new Date(),
      data: {
        message: 'Data export not yet implemented'
      }
    };

    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    console.error('Export data error:', error);
    next(error);
  }
};

// Device Management Controllers

export const registerDevice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { deviceFingerprint, deviceInfo, deviceName } = req.body;

    // Check if device already exists
    const existingDevice = await prisma.deviceFingerprint.findFirst({
      where: {
        fingerprint: deviceFingerprint,
        studentId: req.user!.id
      }
    });

    if (existingDevice) {
      return res.status(409).json({
        success: false,
        error: 'Device already registered'
      });
    }

    // Check device limit
    const deviceCount = await prisma.deviceFingerprint.count({
      where: {
        studentId: req.user!.id,
        isActive: true
      }
    });

    if (deviceCount >= 5) { // Max 5 devices per user
      return res.status(400).json({
        success: false,
        error: 'Maximum device limit reached'
      });
    }

    const device = await prisma.deviceFingerprint.create({
      data: {
        id: uuidv4(),
        studentId: req.user!.id,
        fingerprint: deviceFingerprint,
        deviceInfo: {
          ...deviceInfo,
          name: deviceName || 'Unknown Device'
        },
        isActive: true,
        lastUsed: new Date(),
        createdAt: new Date()
      }
    });

    // Log device registration
    await logActivity(req.user!.id, 'DEVICE_REGISTERED', {
      deviceId: device.id,
      deviceName: deviceName || 'Unknown Device'
    });

    res.status(201).json({
      success: true,
      data: device,
      message: 'Device registered successfully'
    });
  } catch (error) {
    console.error('Register device error:', error);
    next(error);
  }
};

export const getDevices = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const [devices, total] = await Promise.all([
      prisma.deviceFingerprint.findMany({
        where: {
          studentId: req.user!.id
        },
        skip: offset,
        take: limit,
        orderBy: { lastUsed: 'desc' }
      }),
      prisma.deviceFingerprint.count({
        where: {
          studentId: req.user!.id
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        devices,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get devices error:', error);
    next(error);
  }
};

export const removeDevice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const deviceId = req.params.id;

    const device = await prisma.deviceFingerprint.findUnique({
      where: { id: deviceId }
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    if (device.studentId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await prisma.deviceFingerprint.delete({
      where: { id: deviceId }
    });

    // Log device removal
    await logActivity(req.user!.id, 'DEVICE_REMOVED', {
      deviceId,
      deviceName: device.deviceInfo.name || 'Unknown Device'
    });

    res.json({
      success: true,
      message: 'Device removed successfully'
    });
  } catch (error) {
    console.error('Remove device error:', error);
    next(error);
  }
};

// Error handling middleware
export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Attendance Controller Error:', error);

  if (error.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry'
    });
  }

  if (error.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: 'Record not found'
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.errors
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
};