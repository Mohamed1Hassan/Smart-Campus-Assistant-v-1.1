import { Request, Response } from 'express';
import { ScheduleService } from '../services/schedule.service.js';
import prisma from '../../config/database.js';

export class ScheduleController {
  /**
   * Create a new schedule entry
   * POST /api/schedule
   */
  static async createSchedule(req: Request, res: Response): Promise<any> {
    try {
      const { courseId, professorId, dayOfWeek, startTime, endTime, room, semester } = req.body;

      // Validation
      if (!courseId || !professorId || dayOfWeek === undefined || !startTime || !endTime) {
        res.status(400).json({
          success: false,
          message: 'Course ID, professor ID, day of week, start time, and end time are required'
        });
        return;
      }

      const scheduleData = {
        courseId: parseInt(courseId),
        professorId: parseInt(professorId),
        dayOfWeek: parseInt(dayOfWeek),
        startTime,
        endTime,
        room,
        semester
      };

      const schedule = await ScheduleService.createSchedule(scheduleData);

      res.status(201).json({
        success: true,
        message: 'Schedule created successfully',
        data: schedule
      });
    } catch (error: any) {
      console.error('Error creating schedule:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create schedule'
      });
    }
  }

  /**
   * Get all schedules with optional filtering
   * GET /api/schedule
   */
  static async getAllSchedules(req: Request, res: Response): Promise<any> {
    try {
      const { professorId, courseId, dayOfWeek, isActive } = req.query;

      const schedules = await ScheduleService.getAllSchedules(
        professorId ? parseInt(professorId as string) : undefined,
        courseId ? parseInt(courseId as string) : undefined,
        dayOfWeek !== undefined ? parseInt(dayOfWeek as string) : undefined,
        isActive !== undefined ? isActive === 'true' : undefined
      );

      res.status(200).json({
        success: true,
        message: 'Schedules retrieved successfully',
        data: schedules
      });
    } catch (error: any) {
      console.error('Error getting schedules:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve schedules'
      });
    }
  }

  /**
   * Get user's schedule (student or professor)
   * GET /api/schedule/user
   */
  static async getUserSchedule(req: Request, res: Response): Promise<any> {
    try {
      const userId = parseInt((req as any).user.id);
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const enrollments = await prisma.courseEnrollment.findMany({
        where: {
          studentId: userId,
          status: 'ACTIVE'
        },
        include: {
          course: true
        }
      });

      console.log(`[DEBUG] User ${userId} enrollments:`, enrollments.length);

      const courseIds = enrollments.map((e: any) => e.courseId);

      if (courseIds.length === 0) {
        console.log(`[DEBUG] No active enrollments for user ${userId}`);
        return res.json({
          success: true,
          data: []
        });
      }

      const allSchedules = await prisma.schedule.findMany({
        where: {
          courseId: { in: courseIds },
          isActive: true
        },
        include: {
          course: {
            select: {
              id: true,
              courseCode: true,
              courseName: true,
              credits: true
            }
          },
          professor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              universityId: true,
              name: true
            }
          }
        },
        orderBy: [
          { dayOfWeek: 'asc' },
          { startTime: 'asc' }
        ]
      });

      console.log(`[DEBUG] Found ${allSchedules.length} schedules for user ${userId}`);

      const formattedSchedules = allSchedules.map((schedule: any) => ({
        id: schedule.id,
        courseId: schedule.courseId,
        courseCode: schedule.course.courseCode,
        courseName: schedule.course.courseName,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room || 'TBA',
        professorId: schedule.professorId,
        professorFirstName: schedule.professor.firstName,
        professorLastName: schedule.professor.lastName,
        professorName: schedule.professor.name,
        type: 'Lecture' // Default type
      }));

      res.json({
        success: true,
        data: formattedSchedules
      });
    } catch (error: any) {
      console.error('[SCHEDULE] Error fetching user schedule:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user schedule',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get schedule by ID
   * GET /api/schedule/:id
   */
  static async getScheduleById(req: Request, res: Response): Promise<any> {
    try {
      const scheduleId = parseInt(req.params.id);

      if (isNaN(scheduleId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid schedule ID'
        });
        return;
      }

      const schedule = await ScheduleService.getScheduleById(scheduleId);

      if (!schedule) {
        res.status(404).json({
          success: false,
          message: 'Schedule not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Schedule retrieved successfully',
        data: schedule
      });
    } catch (error: any) {
      console.error('Error getting schedule:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve schedule'
      });
    }
  }

  /**
   * Update schedule
   * PUT /api/schedule/:id
   */
  static async updateSchedule(req: Request, res: Response): Promise<any> {
    try {
      const scheduleId = parseInt(req.params.id);

      if (isNaN(scheduleId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid schedule ID'
        });
        return;
      }

      const { dayOfWeek, startTime, endTime, room, semester, isActive } = req.body;

      const updateData = {
        dayOfWeek: dayOfWeek !== undefined ? parseInt(dayOfWeek) : undefined,
        startTime,
        endTime,
        room,
        semester,
        isActive
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      const schedule = await ScheduleService.updateSchedule(scheduleId, updateData);

      res.status(200).json({
        success: true,
        message: 'Schedule updated successfully',
        data: schedule
      });
    } catch (error: any) {
      console.error('Error updating schedule:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update schedule'
      });
    }
  }

  /**
   * Delete schedule
   * DELETE /api/schedule/:id
   */
  static async deleteSchedule(req: Request, res: Response): Promise<any> {
    try {
      const scheduleId = parseInt(req.params.id);

      if (isNaN(scheduleId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid schedule ID'
        });
        return;
      }

      const schedule = await ScheduleService.deleteSchedule(scheduleId);

      res.status(200).json({
        success: true,
        message: 'Schedule deleted successfully',
        data: schedule
      });
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete schedule'
      });
    }
  }

  /**
   * Get schedules for a specific day
   * GET /api/schedule/day/:dayOfWeek
   */
  static async getSchedulesByDay(req: Request, res: Response): Promise<any> {
    try {
      const dayOfWeek = parseInt(req.params.dayOfWeek);
      const { professorId } = req.query;

      if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        res.status(400).json({
          success: false,
          message: 'Day of week must be between 0 (Sunday) and 6 (Saturday)'
        });
        return;
      }

      const schedules = await ScheduleService.getSchedulesByDay(
        dayOfWeek,
        professorId ? parseInt(professorId as string) : undefined
      );

      res.status(200).json({
        success: true,
        message: 'Schedules for day retrieved successfully',
        data: schedules
      });
    } catch (error: any) {
      console.error('Error getting schedules by day:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve schedules for day'
      });
    }
  }

  /**
   * Get schedules for a specific room
   * GET /api/schedule/room/:room
   */
  static async getSchedulesByRoom(req: Request, res: Response): Promise<any> {
    try {
      const room = req.params.room;
      const { dayOfWeek } = req.query;

      if (!room) {
        res.status(400).json({
          success: false,
          message: 'Room parameter is required'
        });
        return;
      }

      const schedules = await ScheduleService.getSchedulesByRoom(
        room,
        dayOfWeek !== undefined ? parseInt(dayOfWeek as string) : undefined
      );

      res.status(200).json({
        success: true,
        message: 'Schedules for room retrieved successfully',
        data: schedules
      });
    } catch (error: any) {
      console.error('Error getting schedules by room:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve schedules for room'
      });
    }
  }

  /**
   * Check for schedule conflicts
   * POST /api/schedule/check-conflict
   */
  static async checkScheduleConflict(req: Request, res: Response): Promise<any> {
    try {
      const { professorId, dayOfWeek, startTime, endTime, room, excludeScheduleId } = req.body;

      if (!professorId || dayOfWeek === undefined || !startTime || !endTime) {
        res.status(400).json({
          success: false,
          message: 'Professor ID, day of week, start time, and end time are required'
        });
        return;
      }

      const conflict = await ScheduleService.checkScheduleConflict(
        parseInt(professorId),
        parseInt(dayOfWeek),
        startTime,
        endTime,
        room,
        excludeScheduleId ? parseInt(excludeScheduleId) : undefined
      );

      res.status(200).json({
        success: true,
        message: 'Conflict check completed',
        data: conflict
      });
    } catch (error: any) {
      console.error('Error checking schedule conflict:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to check schedule conflict'
      });
    }
  }

  /**
   * Get today's schedule for the authenticated user
   * GET /api/schedule/today
   */
  static async getTodaySchedule(req: Request, res: Response): Promise<any> {
    try {
      const userId = parseInt((req as any).user.id);
      const userRole = (req as any).user.role;

      // Allow client to specify day of week (0-6) to handle timezone differences
      // If not provided, fallback to server time
      let dayOfWeek: number;
      if (req.query.dayOfWeek !== undefined) {
        dayOfWeek = parseInt(req.query.dayOfWeek as string);
        if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
          // Fallback to server time if invalid
          const today = new Date();
          dayOfWeek = today.getDay();
        }
      } else {
        const today = new Date();
        dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      }

      const schedules = await ScheduleService.getTodaySchedule(userId, userRole, dayOfWeek);

      res.status(200).json({
        success: true,
        message: 'Today\'s schedule retrieved successfully',
        data: schedules
      });
    } catch (error: any) {
      console.error('Error getting today\'s schedule:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve today\'s schedule'
      });
    }
  }

  /**
   * Get schedule statistics
   * GET /api/schedule/stats
   */
  static async getScheduleStats(req: Request, res: Response): Promise<any> {
    try {
      const { professorId } = req.query;

      const stats = await ScheduleService.getScheduleStats(
        professorId ? parseInt(professorId as string) : undefined
      );

      res.status(200).json({
        success: true,
        message: 'Schedule statistics retrieved successfully',
        data: stats
      });
    } catch (error: any) {
      console.error('Error getting schedule stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve schedule statistics'
      });
    }
  }
  /**
   * Get debug info for schedule
   * GET /api/schedule/debug
   */
  static async debugSchedule(req: Request, res: Response): Promise<any> {
    try {
      const userId = parseInt((req as any).user.id);
      console.log(`[Debug] Debugging schedule for user ${userId}`);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true }
      });

      const enrollments = await prisma.courseEnrollment.findMany({
        where: { studentId: userId },
        include: { course: true }
      });

      const courseIds = enrollments.map((e: any) => e.courseId);

      const allSchedules = await prisma.schedule.findMany({
        where: { courseId: { in: courseIds } },
        include: { course: true }
      });

      const debugData = {
        user,
        enrollmentsCount: enrollments.length,
        enrollments: enrollments.map((e: any) => ({
          course: e.course.courseCode,
          status: e.status
        })),
        schedulesCount: allSchedules.length,
        schedules: allSchedules.map((s: any) => ({
          course: s.course.courseCode,
          day: s.dayOfWeek,
          time: `${s.startTime}-${s.endTime}`,
          isActive: s.isActive
        }))
      };

      console.log('[Debug] Schedule Data:', JSON.stringify(debugData, null, 2));
      res.json(debugData);
    } catch (error: any) {
      console.error('Error in debug endpoint:', error);
      res.status(500).json({ message: 'Debug failed', error: error.message });
    }
  }
}
