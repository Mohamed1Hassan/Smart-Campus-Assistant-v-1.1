import { EncryptionUtils } from '../utils/encryption.js';
import { uploadMiddleware } from '../middleware/upload.middleware.js';
import path from 'path';
import prisma from '../../config/database.js';

/**
 * User Service
 * Business logic for user management operations
 */

// User interface extending the auth service user
export interface UserProfile {
  id: string;
  universityId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'STUDENT' | 'PROFESSOR' | 'ADMIN';
  phone?: string;
  bio?: string;
  department?: string;
  year?: number;
  major?: string;
  avatarUrl?: string;
  isActive: boolean;
  attendancePercent?: number;
  gpa?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Profile update request interface
export interface UpdateProfileRequest {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  universityId?: string;
  phone?: string;
  bio?: string;
  department?: string;
  year?: number;
  major?: string;
}

// Password change request interface
export interface ChangePasswordRequest {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

// Avatar upload request interface
export interface AvatarUploadRequest {
  userId: string;
  file: Express.Multer.File;
}

// Search users request interface
export interface SearchUsersRequest {
  query?: string;
  role?: 'STUDENT' | 'PROFESSOR' | 'ADMIN';
  page?: number;
  limit?: number;
}

// User service class
export class UserService {
  // In-memory user storage (replace with database in production)
  private static users: UserProfile[] = [];

  /**
   * Get user profile by ID
   * @param userId - User ID
   * @returns User profile or null if not found
   */
  static async getUserProfile(userId: string | number): Promise<UserProfile | null> {
    try {
      const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;
      const user = await prisma.user.findUnique({
        where: { id: userIdNum },
        include: {
          enrollments: {
            where: { status: 'ACTIVE' },
            include: {
              course: true
            }
          },
          attendanceRecords: {
            take: 10,
            orderBy: { markedAt: 'desc' },
            include: {
              course: {
                select: {
                  courseCode: true,
                  courseName: true
                }
              }
            }
          }
        }
      });

      if (!user) {
        return null;
      }

      const allAttendanceRecords = await prisma.attendanceRecord.findMany({
        where: { studentId: userIdNum }
      });

      const totalRecords = allAttendanceRecords.length;
      const presentRecords = allAttendanceRecords.filter(r =>
        r.status === 'PRESENT' || r.status === 'LATE'
      ).length;
      const attendancePercent = totalRecords > 0
        ? Math.round((presentRecords / totalRecords) * 100)
        : 0;

      // Calculate GPA (currently returns 0 until grade system is implemented)
      // TODO: Implement grade calculation from course grades when available
      const gpa = 0; // Default to 0 for new students with no grades

      return {
        id: String(user.id),
        universityId: user.universityId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as 'STUDENT' | 'PROFESSOR' | 'ADMIN',
        phone: undefined,
        bio: undefined,
        department: undefined,
        year: user.level ?? undefined,
        major: user.major ?? undefined,
        avatarUrl: undefined,
        attendancePercent,
        gpa,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isActive: true
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw new Error(`Failed to get user profile: ${error}`);
    }
  }

  /**
   * Update user profile
   * @param updateData - Profile update data
   * @returns Updated user profile
   */
  static async updateProfile(updateData: UpdateProfileRequest): Promise<UserProfile> {
    try {
      const userIndex = this.users.findIndex(u => u.id === updateData.userId);

      if (userIndex === -1) {
        throw new Error('User not found');
      }

      const user = this.users[userIndex];

      // Update user fields
      if (updateData.firstName !== undefined) user.firstName = updateData.firstName;
      if (updateData.lastName !== undefined) user.lastName = updateData.lastName;
      if (updateData.email !== undefined) user.email = updateData.email.toLowerCase();
      if (updateData.universityId !== undefined) user.universityId = updateData.universityId;
      if (updateData.phone !== undefined) user.phone = updateData.phone;
      if (updateData.bio !== undefined) user.bio = updateData.bio;
      if (updateData.department !== undefined) user.department = updateData.department;
      if (updateData.year !== undefined) user.year = updateData.year;
      if (updateData.major !== undefined) user.major = updateData.major;

      user.updatedAt = new Date();

      // Check for email uniqueness if email is being updated
      if (updateData.email && updateData.email !== user.email) {
        const emailExists = this.users.some(u => u.email === updateData.email && u.id !== updateData.userId);
        if (emailExists) {
          throw new Error('Email already exists');
        }
      }

      // Check for university ID uniqueness if universityId is being updated
      if (updateData.universityId && updateData.universityId !== user.universityId) {
        const universityIdExists = this.users.some(u => u.universityId === updateData.universityId && u.id !== updateData.userId);
        if (universityIdExists) {
          throw new Error('University ID already exists');
        }
      }

      this.users[userIndex] = user;
      return user;
    } catch (error) {
      throw new Error(`Failed to update profile: ${error}`);
    }
  }

  /**
   * Change user password
   * @param changePasswordData - Password change data
   */
  static async changePassword(changePasswordData: ChangePasswordRequest): Promise<void> {
    try {
      const userIndex = this.users.findIndex(u => u.id === changePasswordData.userId);

      if (userIndex === -1) {
        throw new Error('User not found');
      }

      // In a real application, you would verify the current password here
      // For now, we'll assume the password verification is handled by the auth service

      // Validate new password strength
      if (changePasswordData.newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters long');
      }

      // Update user's updatedAt timestamp
      this.users[userIndex].updatedAt = new Date();

      // In a real application, you would hash and store the new password here
      // For now, we'll just update the timestamp
    } catch (error) {
      throw new Error(`Failed to change password: ${error}`);
    }
  }

  /**
   * Upload user avatar
   * @param avatarData - Avatar upload data
   * @returns Updated user profile with avatar URL
   */
  static async uploadAvatar(avatarData: AvatarUploadRequest): Promise<UserProfile> {
    try {
      const userIndex = this.users.findIndex(u => u.id === avatarData.userId);

      if (userIndex === -1) {
        throw new Error('User not found');
      }

      const user = this.users[userIndex];

      // Delete old avatar if exists
      if (user.avatarUrl) {
        const oldFileName = path.basename(user.avatarUrl);
        const oldFilePath = path.join(process.cwd(), 'uploads', 'avatars', oldFileName);

        if (uploadMiddleware.fileExists(oldFilePath)) {
          await uploadMiddleware.deleteFile(oldFilePath);
        }
      }

      // Process the uploaded image
      const processedPath = await uploadMiddleware.processImage(avatarData.file.path);

      // Generate avatar URL
      const avatarUrl = uploadMiddleware.getFileUrl(avatarData.file.filename);

      // Update user profile
      user.avatarUrl = avatarUrl;
      user.updatedAt = new Date();

      this.users[userIndex] = user;
      return user;
    } catch (error) {
      // Clean up uploaded file if there was an error
      if (avatarData.file && avatarData.file.path) {
        try {
          await uploadMiddleware.deleteFile(avatarData.file.path);
        } catch (cleanupError) {
          console.error('Failed to cleanup uploaded file:', cleanupError);
        }
      }
      throw new Error(`Failed to upload avatar: ${error}`);
    }
  }

  /**
   * Delete user avatar
   * @param userId - User ID
   * @returns Updated user profile
   */
  static async deleteAvatar(userId: string): Promise<UserProfile> {
    try {
      const userIndex = this.users.findIndex(u => u.id === userId);

      if (userIndex === -1) {
        throw new Error('User not found');
      }

      const user = this.users[userIndex];

      // Delete avatar file if exists
      if (user.avatarUrl) {
        const fileName = path.basename(user.avatarUrl);
        const filePath = path.join(process.cwd(), 'uploads', 'avatars', fileName);

        if (uploadMiddleware.fileExists(filePath)) {
          await uploadMiddleware.deleteFile(filePath);
        }
      }

      // Update user profile
      user.avatarUrl = undefined;
      user.updatedAt = new Date();

      this.users[userIndex] = user;
      return user;
    } catch (error) {
      throw new Error(`Failed to delete avatar: ${error}`);
    }
  }

  /**
   * Search users
   * @param searchData - Search parameters
   * @returns Array of matching users
   */
  static async searchUsers(searchData: SearchUsersRequest): Promise<{
    users: UserProfile[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      let filteredUsers = [...this.users];

      // Filter by role if specified
      if (searchData.role) {
        filteredUsers = filteredUsers.filter(user => user.role === searchData.role);
      }

      // Filter by search query if specified
      if (searchData.query) {
        const query = searchData.query.toLowerCase();
        filteredUsers = filteredUsers.filter(user =>
          user.firstName.toLowerCase().includes(query) ||
          user.lastName.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.universityId.toLowerCase().includes(query) ||
          (user.department && user.department.toLowerCase().includes(query)) ||
          (user.major && user.major.toLowerCase().includes(query))
        );
      }

      // Sort by name
      filteredUsers.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

      const total = filteredUsers.length;
      const page = searchData.page || 1;
      const limit = searchData.limit || 10;
      const totalPages = Math.ceil(total / limit);

      // Paginate results
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const users = filteredUsers.slice(startIndex, endIndex);

      return {
        users,
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      throw new Error(`Failed to search users: ${error}`);
    }
  }

  /**
   * Get all users (admin only)
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated list of users
   */
  static async getAllUsers(page: number = 1, limit: number = 10): Promise<{
    users: UserProfile[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const total = this.users.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      const users = this.users.slice(startIndex, endIndex);

      return {
        users,
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      throw new Error(`Failed to get all users: ${error}`);
    }
  }

  /**
   * Deactivate user account
   * @param userId - User ID to deactivate
   */
  static async deactivateUser(userId: string): Promise<void> {
    try {
      const userIndex = this.users.findIndex(u => u.id === userId);

      if (userIndex === -1) {
        throw new Error('User not found');
      }

      this.users[userIndex].isActive = false;
      this.users[userIndex].updatedAt = new Date();
    } catch (error) {
      throw new Error(`Failed to deactivate user: ${error}`);
    }
  }

  /**
   * Activate user account
   * @param userId - User ID to activate
   */
  static async activateUser(userId: string): Promise<void> {
    try {
      const userIndex = this.users.findIndex(u => u.id === userId);

      if (userIndex === -1) {
        throw new Error('User not found');
      }

      this.users[userIndex].isActive = true;
      this.users[userIndex].updatedAt = new Date();
    } catch (error) {
      throw new Error(`Failed to activate user: ${error}`);
    }
  }

  /**
   * Delete user account
   * @param userId - User ID to delete
   */
  static async deleteUser(userId: string): Promise<void> {
    try {
      const userIndex = this.users.findIndex(u => u.id === userId);

      if (userIndex === -1) {
        throw new Error('User not found');
      }

      const user = this.users[userIndex];

      // Delete avatar file if exists
      if (user.avatarUrl) {
        const fileName = path.basename(user.avatarUrl);
        const filePath = path.join(process.cwd(), 'uploads', 'avatars', fileName);

        if (uploadMiddleware.fileExists(filePath)) {
          await uploadMiddleware.deleteFile(filePath);
        }
      }

      // Remove user from array
      this.users.splice(userIndex, 1);
    } catch (error) {
      throw new Error(`Failed to delete user: ${error}`);
    }
  }

  /**
   * Create a new user (for testing/admin purposes)
   * @param userData - User data
   * @returns Created user profile
   */
  static async createUser(userData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const newUser: UserProfile = {
        id: this.generateUserId(),
        universityId: userData.universityId || '',
        email: userData.email || '',
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        role: userData.role || 'STUDENT',
        phone: userData.phone,
        bio: userData.bio,
        department: userData.department,
        year: userData.year,
        major: userData.major,
        avatarUrl: userData.avatarUrl,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.users.push(newUser);
      return newUser;
    } catch (error) {
      throw new Error(`Failed to create user: ${error}`);
    }
  }

  /**
   * Generate unique user ID
   * @returns Unique user ID
   */
  private static generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get student statistics for dashboard
   * @param userId - Student user ID
   * @returns Student statistics
   */
  static async getStudentStats(userId: string | number): Promise<any> {
    try {
      const studentId = typeof userId === 'string' ? parseInt(userId) : userId;

      // 1. Get enrolled courses (ACTIVE only)
      const enrollments = await prisma.courseEnrollment.findMany({
        where: {
          studentId: studentId,
          status: 'ACTIVE'
        },
        include: {
          course: true
        }
      });

      // 2. Calculate total credits from ACTIVE enrollments only
      const totalCredits = enrollments.reduce((sum, e) => sum + e.course.credits, 0);

      // 3. Get COMPLETED courses count (not from active enrollments)
      const completedCourses = await prisma.courseEnrollment.count({
        where: {
          studentId: studentId,
          status: 'COMPLETED'
        }
      });

      // 4. Calculate attendance percentage correctly (including missed classes)
      const now = new Date();

      // Calculate total expected sessions for enrolled courses
      let totalExpectedSessions = 0;
      for (const enrollment of enrollments) {
        const count = await prisma.qRCode.count({
          where: {
            courseId: enrollment.courseId,
            validTo: { lt: now },
            isActive: true,
            validFrom: { gte: enrollment.enrolledAt }
          }
        });
        totalExpectedSessions += count;
      }

      // Get attendance records for these courses
      const attendanceRecords = await prisma.attendanceRecord.findMany({
        where: {
          studentId: studentId,
          courseId: { in: enrollments.map(e => e.courseId) }
        }
      });

      const presentSessions = attendanceRecords.filter(r =>
        r.status === 'PRESENT' || r.status === 'LATE'
      ).length;

      const attendancePercentage = totalExpectedSessions > 0
        ? Math.round((presentSessions / totalExpectedSessions) * 100)
        : 0;

      // 5. Calculate today's upcoming classes from Schedule
      const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
      const courseIds = enrollments.map(e => e.courseId);

      let upcomingClasses = 0;
      if (courseIds.length > 0) {
        const todaySchedule = await prisma.schedule.findMany({
          where: {
            dayOfWeek: today,
            isActive: true,
            courseId: { in: courseIds }
          },
          include: {
            course: true
          }
        });

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes

        upcomingClasses = todaySchedule.filter(schedule => {
          const [hours, minutes] = schedule.startTime.split(':').map(Number);
          const scheduleTime = hours * 60 + minutes; // Schedule time in minutes
          return scheduleTime >= currentTime; // Upcoming or current classes
        }).length;
      }

      // 6. Calculate Pending Assignments from Notifications
      // Count unread notifications with ASSIGNMENT or DEADLINE category
      const pendingAssignments = await prisma.notification.count({
        where: {
          userId: studentId,
          isRead: false,
          category: {
            in: ['ASSIGNMENT', 'DEADLINE']
          }
        }
      });

      // 7. Calculate GPA from grades (when grade system is implemented)
      // For now, return 0 if student has no grades
      // TODO: Implement grade calculation from grades table when available
      const gpa = 0; // Will be calculated from grades once grade system is implemented

      // 8. Get current semester from most recent schedule or default
      let currentSemester = 'Fall 2024';

      if (courseIds.length > 0) {
        const latestSchedule = await prisma.schedule.findFirst({
          where: {
            courseId: { in: courseIds },
            isActive: true
          },
          orderBy: { createdAt: 'desc' },
          select: {
            semester: true
          }
        });

        if (latestSchedule?.semester) {
          currentSemester = latestSchedule.semester;
        }
      }

      return {
        gpa: gpa,
        upcomingClasses: upcomingClasses,
        completedCourses: completedCourses, // Only completed courses, no fallback
        pendingAssignments: pendingAssignments, // Real count from notifications
        attendancePercentage: attendancePercentage,
        totalCredits: totalCredits,
        currentSemester: currentSemester
      };
    } catch (error) {
      console.error('Error getting student stats:', error);
      return {
        gpa: 0,
        upcomingClasses: 0,
        completedCourses: 0,
        pendingAssignments: 0,
        attendancePercentage: 0,
        totalCredits: 0,
        currentSemester: 'Fall 2024'
      };
    }
  }

  /**
   * Get user statistics
   * @returns User statistics
   */
  static async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: {
      STUDENT: number;
      PROFESSOR: number;
      ADMIN: number;
    };
  }> {
    try {
      const total = this.users.length;
      const active = this.users.filter(u => u.isActive).length;
      const inactive = total - active;

      const byRole = {
        STUDENT: this.users.filter(u => u.role === 'STUDENT').length,
        PROFESSOR: this.users.filter(u => u.role === 'PROFESSOR').length,
        ADMIN: this.users.filter(u => u.role === 'ADMIN').length
      };

      return {
        total,
        active,
        inactive,
        byRole
      };
    } catch (error) {
      throw new Error(`Failed to get user statistics: ${error}`);
    }
  }
}

export default UserService;
