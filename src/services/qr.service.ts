import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database.js';

export interface QRCodeData {
  sessionId: string;
  courseId: number;
  professorId: number;
  title: string;
  description?: string;
  expiresAt: Date;
}

export interface QRCodeResponse {
  sessionId: string;
  qrCodeDataUrl: string;
  expiresAt: Date;
  courseId: number;
  title: string;
}

export class QRService {
  /**
   * Generate a unique session ID for attendance
   */
  static generateSessionId(): string {
    return uuidv4();
  }

  /**
   * Create QR code data for attendance session
   */
  static async createQRCodeData(data: QRCodeData): Promise<QRCodeResponse> {
    try {
      // Create QR code record in database
      const qrCodeRecord = await prisma.qRCode.create({
        data: {
          sessionId: data.sessionId,
          sessionId: data.sessionId,
          course: { connect: { id: data.courseId } },
          professor: { connect: { id: data.professorId } },
          title: data.title,
          description: data.description,
          expiresAt: data.expiresAt,
          latitude: 0,
          longitude: 0,
          validFrom: new Date(),
          validTo: data.expiresAt,
        },
      });

      // Generate QR code data URL
      const qrCodeDataUrl = await this.generateQRCodeDataUrl(data.sessionId);

      return {
        sessionId: qrCodeRecord.sessionId,
        qrCodeDataUrl,
        expiresAt: qrCodeRecord.expiresAt,
        courseId: qrCodeRecord.courseId,
        title: qrCodeRecord.title,
      };
    } catch (error) {
      console.error('Error creating QR code data:', error);
      throw new Error('Failed to create QR code data');
    }
  }

  /**
   * Generate QR code as data URL
   */
  static async generateQRCodeDataUrl(sessionId: string): Promise<string> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(sessionId, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      return qrCodeDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Validate QR code session
   */
  static async validateQRCodeSession(sessionId: string): Promise<{
    isValid: boolean;
    qrCode?: any;
    error?: string;
  }> {
    try {
      const qrCode = await prisma.qRCode.findUnique({
        where: { sessionId },
        include: {
          course: true,
          professor: true,
        },
      });

      if (!qrCode) {
        return {
          isValid: false,
          error: 'QR code session not found',
        };
      }

      if (!qrCode.isActive) {
        return {
          isValid: false,
          error: 'QR code session is no longer active',
        };
      }

      if (new Date() > qrCode.expiresAt) {
        return {
          isValid: false,
          error: 'QR code session has expired',
        };
      }

      return {
        isValid: true,
        qrCode,
      };
    } catch (error) {
      console.error('Error validating QR code session:', error);
      return {
        isValid: false,
        error: 'Failed to validate QR code session',
      };
    }
  }

  /**
   * Deactivate QR code session
   */
  static async deactivateQRCodeSession(sessionId: string): Promise<boolean> {
    try {
      await prisma.qRCode.update({
        where: { sessionId },
        data: { isActive: false },
      });
      return true;
    } catch (error) {
      console.error('Error deactivating QR code session:', error);
      return false;
    }
  }

  /**
   * Get QR code session details
   */
  static async getQRCodeSession(sessionId: string) {
    try {
      return await prisma.qRCode.findUnique({
        where: { sessionId },
        include: {
          course: true,
          professor: true,
          attendanceRecords: {
            include: {
              student: true,
            },
          },
        },
      });
    } catch (error) {
      console.error('Error getting QR code session:', error);
      throw new Error('Failed to get QR code session');
    }
  }

  /**
   * Get active QR codes for a course
   */
  static async getActiveQRCodesForCourse(courseId: number) {
    try {
      return await prisma.qRCode.findMany({
        where: {
          courseId,
          isActive: true,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          course: true,
          professor: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      console.error('Error getting active QR codes for course:', error);
      throw new Error('Failed to get active QR codes for course');
    }
  }

  /**
   * Get QR code history for a course
   */
  static async getQRCodeHistoryForCourse(courseId: number, limit: number = 10) {
    try {
      return await prisma.qRCode.findMany({
        where: { courseId },
        include: {
          course: true,
          professor: true,
          attendanceRecords: {
            include: {
              student: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });
    } catch (error) {
      console.error('Error getting QR code history for course:', error);
      throw new Error('Failed to get QR code history for course');
    }
  }
}
