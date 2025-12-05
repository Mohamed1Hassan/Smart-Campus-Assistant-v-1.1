import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Home, GraduationCap, Calendar, BookOpen, FileText, RefreshCw, Timer, Sparkles, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AIAssistantButton } from '../components/common/AIAssistantButton';
import DashboardLayout from '../components/common/DashboardLayout';
import StatCardStudent from '../components/student/StatCardStudent';
import SchedulePreview from '../components/student/SchedulePreview';
import AnnouncementsList from '../components/student/AnnouncementsList';
import { StatsSkeleton } from '../components/common/LoadingSkeleton';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useToast } from '../components/common/ToastProvider';
import { apiClient } from '../services/api';

// Types for dashboard data
interface StudentStats {
  gpa: number;
  upcomingClasses: number;
  completedCourses: number;
  pendingAssignments: number;
  attendancePercentage: number;
  totalCredits: number;
  currentSemester: string;
}

interface ScheduleClass {
  id: string;
  course: string;
  time: string;
  room: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  startTime?: string;
  endTime?: string;
  courseCode?: string;
  professor?: string;
}

interface Announcement {
  id: string;
  icon: 'megaphone' | 'building' | 'lightbulb' | 'book' | 'calendar' | 'alert';
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'warning' | 'success';
}

export default function StudentDashboard() {
  const { user, isAuthenticated } = useAuth();
  const { notifications } = useNotifications();
  const { success: showSuccess, error: showError, info: showInfo } = useToast();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dev mode check for logging
  const DEV = import.meta.env?.DEV;

  // 1. Fetch Student Stats
  const { data: stats = null, isLoading: statsLoading } = useQuery({
    queryKey: ['student-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await apiClient.get<StudentStats>('/api/users/student/stats');
      if (res.success) return res.data;
      throw new Error(res.message || 'Failed to fetch stats');
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Helper to convert 24h time to 12h format
  const formatTime = (time: string) => {
    if (!time) return '00:00 AM';
    const parts = time.split(':').map(Number);
    if (parts.length < 2) return time;
    const [hours, minutes] = parts;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Helper to determine class status
  const getClassStatus = (startTime: string, endTime: string): 'upcoming' | 'ongoing' | 'completed' => {
    if (!startTime || !endTime) return 'upcoming';

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const startParts = startTime.split(':').map(Number);
    if (startParts.length < 2) return 'upcoming';
    const [startHours, startMins] = startParts;
    const startMinutes = startHours * 60 + startMins;

    const endParts = endTime.split(':').map(Number);
    if (endParts.length < 2) return 'upcoming';
    const [endHours, endMins] = endParts;
    const endMinutes = endHours * 60 + endMins;

    if (currentMinutes < startMinutes) return 'upcoming';
    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) return 'ongoing';
    return 'completed';
  };

  // 2. Fetch Schedule
  const { data: todaySchedule = [], isLoading: scheduleLoading } = useQuery({
    queryKey: ['student-schedule-today', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      // Get current day of week (0-6) from client's local time
      const currentDayOfWeek = new Date().getDay();

      const [scheduleRes, sessionsRes] = await Promise.all([
        apiClient.get<any[]>('/api/schedule/today', {
          params: { dayOfWeek: currentDayOfWeek }
        }),
        apiClient.get<any>('/api/attendance/sessions', {
          params: {
            startDate: start.toISOString(),
            endDate: end.toISOString()
          }
        })
      ]);

      const scheduleData = scheduleRes?.success && Array.isArray(scheduleRes.data) ? scheduleRes.data : [];
      const activeSessions = sessionsRes?.success && Array.isArray(sessionsRes.data?.data)
        ? sessionsRes.data.data
        : [];

      // Transform static schedule
      const staticSchedule = scheduleData.map((item: any) => {
        const normalizeTime = (t: string) => {
          if (!t) return '00:00';
          const parts = t.split(':');
          if (parts.length < 2) return '00:00';
          return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        };
        const startStr = normalizeTime(item.startTime);
        const endStr = normalizeTime(item.endTime);

        return {
          id: String(item.id),
          course: `${item.courseName} (${item.courseCode})`,
          time: `${formatTime(item.startTime || '00:00')} - ${formatTime(item.endTime || '00:00')}`,
          room: item.room,
          status: getClassStatus(startStr, endStr),
          startTime: startStr,
          endTime: endStr,
          courseCode: item.courseCode,
          professor: item.professorName || `${item.professorFirstName} ${item.professorLastName}`,
          isActive: false,
          _originalCourseName: item.courseName
        };
      });

      // Transform active sessions
      const activeSessionItems = activeSessions
        .filter((session: any) => {
          // Check if session is active or scheduled for today
          const isToday = new Date(session.startTime).toDateString() === new Date().toDateString();
          // Backend returns isActive, but we also check validFrom/validTo if available
          return session.isActive || (session.status === 'ACTIVE') || isToday;
        })
        .map((session: any) => {
          const startTime = new Date(session.startTime);
          const endTime = new Date(session.endTime);
          const toTimeStr = (date: Date) => {
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
          };
          const startStr = toTimeStr(startTime);
          const endStr = toTimeStr(endTime);

          // Calculate status dynamically
          let status: 'upcoming' | 'ongoing' | 'completed' = 'upcoming';
          const now = new Date();

          if (session.isActive && now >= startTime && now <= endTime) {
            status = 'ongoing';
          } else if (now > endTime) {
            status = 'completed';
          } else {
            status = getClassStatus(startStr, endStr);
          }

          return {
            id: session.id || session.sessionId,
            course: `${session.courseName}`,
            time: `${startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${endTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
            room: session.location?.name || 'Online',
            status: status,
            startTime: startStr,
            endTime: endStr,
            courseCode: '',
            professor: '',
            isActive: session.isActive || session.status === 'ACTIVE',
            _originalCourseName: session.courseName
          };
        });

      // Merge logic
      const mergedSchedule = [...activeSessionItems];
      staticSchedule.forEach((staticItem: any) => {
        const hasActiveSession = activeSessionItems.some((active: any) =>
          active.course.includes(staticItem._originalCourseName) ||
          (active.courseCode && active.courseCode === staticItem.courseCode)
        );
        if (!hasActiveSession) {
          mergedSchedule.push(staticItem);
        }
      });

      // Sort by time
      mergedSchedule.sort((a: any, b: any) => {
        if (a.status === 'ongoing' && b.status !== 'ongoing') return -1;
        if (a.status !== 'ongoing' && b.status === 'ongoing') return 1;
        return a.startTime.localeCompare(b.startTime);
      });

      return mergedSchedule;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Helper to format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Helper to map notification type/category to announcement icon/type
  const mapNotificationToAnnouncement = (notification: any): Announcement => {
    let icon: Announcement['icon'] = 'megaphone';
    let type: Announcement['type'] = 'info';

    switch (notification.category) {
      case 'ANNOUNCEMENT': icon = 'megaphone'; break;
      case 'SYSTEM': icon = 'building'; break;
      case 'COURSE': icon = 'book'; break;
      case 'EXAM':
      case 'DEADLINE': icon = 'calendar'; break;
      case 'ASSIGNMENT': icon = 'lightbulb'; break;
      case 'ATTENDANCE': icon = 'alert'; break;
      default: icon = 'megaphone';
    }

    switch (notification.type) {
      case 'INFO': type = 'info'; break;
      case 'WARNING':
      case 'URGENT':
      case 'ERROR': type = 'warning'; break;
      case 'SUCCESS': type = 'success'; break;
      default: type = 'info';
    }

    return {
      id: String(notification.id),
      icon,
      title: notification.title,
      message: notification.message,
      timestamp: formatTimeAgo(notification.createdAt),
      type
    };
  };

  // 3. Announcements (Derived from notifications)
  const announcements = useMemo(() => {
    if (!notifications || notifications.length === 0) return [];
    return notifications
      .filter(n => ['ANNOUNCEMENT', 'SYSTEM', 'EXAM', 'DEADLINE'].includes(n.category))
      .slice(0, 5)
      .map(mapNotificationToAnnouncement);
  }, [notifications]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['student-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['student-schedule'] }),
      // Notifications are handled by context, but we can simulate a refresh delay
      new Promise(resolve => setTimeout(resolve, 500))
    ]);
    setIsRefreshing(false);
  };

  // Show welcome toast only once per session
  useEffect(() => {
    const hasSeenWelcome = sessionStorage.getItem('hasSeenWelcome');
    if (isAuthenticated && !hasSeenWelcome && !statsLoading && stats) {
      showInfo(`Welcome back, ${user?.firstName || 'Student'}!`, { title: 'Dashboard ready' });
      sessionStorage.setItem('hasSeenWelcome', 'true');
    }
  }, [isAuthenticated, statsLoading, stats]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5
      }
    }
  };

  if (statsLoading && !stats) {
    return (
      <DashboardLayout userName={user?.firstName} userType="student">
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <StatsSkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout userName={user?.firstName} userType="student">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6 sm:space-y-8"
      >
        {/* Header Section */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-6">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20"
            >
              <LayoutDashboard className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                Dashboard
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Welcome back, {user?.firstName} 👋
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium">
              <Calendar className="w-4 h-4" />
              {stats?.currentSemester || 'Fall 2024'}
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all hover:shadow-md active:scale-95 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`}
              title="Refresh Dashboard"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {/* Stats Grid - 2 Columns on Mobile, 4 on Desktop */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <StatCardStudent
            title="GPA"
            value={stats?.gpa?.toFixed(2) || '3.85'}
            icon={GraduationCap}
            color="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
            delay={0.1}
            subtitle="Excellent"
          />
          <StatCardStudent
            title="Credits"
            value={stats?.totalCredits ?? 0}
            icon={BookOpen}
            color="bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
            delay={0.2}
            subtitle="Earned"
          />
          <StatCardStudent
            title="Attendance"
            value={`${stats?.attendancePercentage ?? 0}%`}
            icon={Timer}
            color="bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400"
            delay={0.3}
            subtitle="Overall"
          />
          <StatCardStudent
            title="Assignments"
            value={stats?.pendingAssignments ?? 0}
            icon={FileText}
            color="bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
            delay={0.4}
            subtitle="Pending"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Schedule */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-2 space-y-6"
          >
            <SchedulePreview classes={todaySchedule} />

            {/* Quick Actions (Mobile Only) */}
            <div className="lg:hidden grid grid-cols-2 gap-3">
              <button className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20 flex flex-col items-center justify-center gap-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Sparkles className="w-6 h-6" />
                </div>
                <span className="font-medium">Ask AI</span>
              </button>
              <button className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-700 dark:text-gray-200 shadow-sm flex flex-col items-center justify-center gap-2">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <Calendar className="w-6 h-6" />
                </div>
                <span className="font-medium">Full Schedule</span>
              </button>
            </div>
          </motion.div>

          {/* Right Column: Announcements */}
          <motion.div
            variants={itemVariants}
            className="space-y-6"
          >
            <AnnouncementsList announcements={announcements} />
          </motion.div>
        </div>
      </motion.div>
      {/* AI Assistant Button */}
      <AIAssistantButton userType="student" />
    </DashboardLayout>
  );
}
