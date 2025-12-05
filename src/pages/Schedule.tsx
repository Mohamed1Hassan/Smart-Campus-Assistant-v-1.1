import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Download, AlertCircle, CalendarDays } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '../components/common/DashboardLayout';
import ScheduleStats from '../components/student/schedule/ScheduleStats';
import ScheduleTable from '../components/student/schedule/ScheduleTable';
import FilterBar from '../components/student/schedule/FilterBar';
import {
  ScheduleClass,
  getCurrentDay,
  loadScheduleFilters,
  saveScheduleFilters,
  dayOptions
} from '../data/scheduleDataNew';
import { apiClient } from '../services/api';
import { useToast } from '../components/common/ToastProvider';
import { useAuth } from '../contexts/AuthContext';

export default function Schedule() {
  const { user } = useAuth();
  const [currentDay, setCurrentDay] = useState(getCurrentDay());
  const [filters, setFilters] = useState(loadScheduleFilters());
  const [searchTerm, setSearchTerm] = useState('');
  const { success, info } = useToast();

  const [debugData, setDebugData] = useState<any>(null);

  // Debug: Check database content directly
  useEffect(() => {
    const checkDebugData = async () => {
      try {
        const res = await apiClient.get('/schedule/debug');
        console.log('🔍 [DEBUG ENDPOINT] Database Content:', res.data);
        setDebugData(res.data);
      } catch (err) {
        console.error('❌ [DEBUG ENDPOINT] Failed to fetch debug info:', err);
        setDebugData({ error: 'Failed to fetch debug info' });
      }
    };
    checkDebugData();
  }, []);

  // Fetch schedule data
  const { data: classes = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['student-schedule', user?.id],
    queryFn: async () => {
      const response = await apiClient.get('/schedule/user');
      console.log('Schedule API Response:', response); // Debug logging

      if (response.success && response.data) {
        // Map backend data to frontend ScheduleClass format
        return response.data.map((item: any) => {
          // Convert dayOfWeek (0-6) to string day name
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const dayName = days[item.dayOfWeek];

          // Format time (assuming HH:MM format from backend)
          const formatTime = (timeStr: string) => {
            if (!timeStr) return 'TBA';
            const [hours, minutes] = timeStr.split(':');
            const h = parseInt(hours);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${h12}:${minutes} ${ampm}`;
          };

          const startTimeFormatted = formatTime(item.startTime);
          const endTimeFormatted = formatTime(item.endTime);

          // Calculate duration
          const start = new Date(`2000/01/01 ${item.startTime || '00:00'}`);
          const end = new Date(`2000/01/01 ${item.endTime || '00:00'}`);
          const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

          // Determine status
          const now = new Date();
          const currentDayIndex = now.getDay();
          const currentTime = now.getHours() * 60 + now.getMinutes();

          const safeSplitTime = (timeStr: string) => {
            if (!timeStr) return [0, 0];
            return timeStr.split(':').map(Number);
          };

          const [startH, startM] = safeSplitTime(item.startTime);
          const [endH, endM] = safeSplitTime(item.endTime);
          const startTimeMins = startH * 60 + startM;
          const endTimeMins = endH * 60 + endM;

          let status: 'upcoming' | 'ongoing' | 'completed' = 'upcoming';

          // Adjust days for Saturday start of week (Sat=0, Sun=1, ..., Fri=6)
          // JS getDay(): Sun=0, Mon=1, ..., Sat=6
          // Mapping: Sat(6)->0, Sun(0)->1, Mon(1)->2, ..., Fri(5)->6
          const adjustDay = (d: number) => (d + 1) % 7;

          const currentDayAdjusted = adjustDay(currentDayIndex);
          const classDayAdjusted = adjustDay(item.dayOfWeek);

          if (classDayAdjusted < currentDayAdjusted) {
            status = 'completed';
          } else if (classDayAdjusted > currentDayAdjusted) {
            status = 'upcoming';
          } else {
            // Same day
            if (currentTime >= startTimeMins && currentTime <= endTimeMins) {
              status = 'ongoing';
            } else if (currentTime > endTimeMins) {
              status = 'completed';
            } else {
              status = 'upcoming';
            }
          }

          return {
            id: item.id.toString(),
            course: item.courseName,
            day: dayName,
            time: `${startTimeFormatted} - ${endTimeFormatted}`,
            room: item.room,
            professorName: item.professorName, // Full name with title
            instructor: `Dr. ${item.professorFirstName} ${item.professorLastName}`,
            status: status,
            duration: `${durationHours.toFixed(1)}h`,
            type: durationHours >= 1.8 ? 'Lecture' : 'Section'
          };
        });
      }
      return [];
    },
    enabled: !!user?.id,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Force refetch when component mounts
  });

  useEffect(() => {
    // Update current day every minute
    const interval = setInterval(() => {
      setCurrentDay(getCurrentDay());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Save filters when they change
  useEffect(() => {
    saveScheduleFilters(filters);
  }, [filters]);

  // Filter logic
  const filteredClasses = useMemo(() => {
    return classes.filter((cls: ScheduleClass) => {
      const matchesDay = filters.day === 'Days' || cls.day === filters.day;
      const matchesStatus = filters.status === 'Status' ||
        (filters.status === 'Upcoming' && cls.status === 'upcoming') ||
        (filters.status === 'Ongoing' && cls.status === 'ongoing') ||
        (filters.status === 'Completed' && cls.status === 'completed');
      const matchesSearch = cls.course.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cls.instructor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cls.room.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesDay && matchesStatus && matchesSearch;
    }).sort((a: ScheduleClass, b: ScheduleClass) => {
      const dayOrder: { [key: string]: number } = {
        'Saturday': 0,
        'Sunday': 1,
        'Monday': 2,
        'Tuesday': 3,
        'Wednesday': 4,
        'Thursday': 5,
        'Friday': 6
      };

      const dayDiff = (dayOrder[a.day] || 0) - (dayOrder[b.day] || 0);
      if (dayDiff !== 0) return dayDiff;

      // Secondary sort by time
      const getMinutes = (timeStr: string) => {
        if (!timeStr) return 0;
        const startTime = timeStr.split(' - ')[0];
        if (!startTime) return 0;

        const [time, period] = startTime.split(' ');
        if (!time) return 0;

        const parts = time.split(':').map(Number);
        let hours = parts[0];
        const minutes = parts[1] || 0;

        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };

      return getMinutes(a.time) - getMinutes(b.time);
    });
  }, [classes, filters, searchTerm]);

  const handleExport = () => {
    // Basic ICS export logic
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Smart Campus//Student Schedule//EN\n";

    classes.forEach((cls: ScheduleClass) => {
      icsContent += "BEGIN:VEVENT\n";
      icsContent += `SUMMARY:${cls.course}\n`;
      icsContent += `DESCRIPTION:Instructor: ${cls.instructor}\\nRoom: ${cls.room}\n`;
      icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'schedule.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    success('Schedule exported successfully');
  };

  const handleRefresh = () => {
    refetch();
    info('Schedule updated');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20"
            >
              <CalendarDays className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                My Class Schedule
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Manage your weekly classes and view details
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              className="p-2 rounded-full bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="Refresh Schedule"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/30 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </motion.button>
          </div>
        </div>

        {/* Day Switcher - Mobile/Tablet Optimized */}
        <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {dayOptions.slice(1).map((day) => (
            <motion.button
              key={day}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilters({ ...filters, day })}
              className={`
                flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                ${filters.day === day
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md shadow-purple-500/20'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700'
                }
              `}
            >
              {day}
            </motion.button>
          ))}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilters({ ...filters, day: 'Days' })}
            className={`
              flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
              ${filters.day === 'Days'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md shadow-purple-500/20'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700'
              }
            `}
          >
            All Days
          </motion.button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading your schedule...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">Failed to load schedule</h3>
            <p className="text-red-600 dark:text-red-300 mb-4">{error instanceof Error ? error.message : 'An unknown error occurred'}</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-lg hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {classes.length === 0 ? (
              <div className="space-y-8">
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="w-20 h-20 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CalendarDays className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Classes Scheduled</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    You don't have any classes scheduled for this semester yet, or there might be an issue retrieving your schedule.
                  </p>
                </div>

                {/* Debug Info Section */}
                <div className="p-6 border border-red-200 dark:border-red-900/30 rounded-2xl bg-red-50/50 dark:bg-red-900/10">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                    <div>
                      <h4 className="text-lg font-semibold text-red-700 dark:text-red-400">Debug Information</h4>
                      <p className="text-sm text-red-600 dark:text-red-300">
                        Please share this information with technical support.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm text-gray-700 dark:text-gray-300">User Info</h5>
                      <pre className="bg-white dark:bg-gray-950 p-4 rounded-xl text-xs overflow-auto border border-gray-200 dark:border-gray-800 font-mono">
                        {JSON.stringify(debugData?.user || {}, null, 2)}
                      </pre>
                    </div>

                    <div className="space-y-2">
                      <h5 className="font-medium text-sm text-gray-700 dark:text-gray-300">Enrollments ({debugData?.enrollmentsCount || 0})</h5>
                      <pre className="bg-white dark:bg-gray-950 p-4 rounded-xl text-xs overflow-auto border border-gray-200 dark:border-gray-800 font-mono max-h-60">
                        {JSON.stringify(debugData?.enrollments || [], null, 2)}
                      </pre>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <h5 className="font-medium text-sm text-gray-700 dark:text-gray-300">All Schedules Found ({debugData?.schedulesCount || 0})</h5>
                      <pre className="bg-white dark:bg-gray-950 p-4 rounded-xl text-xs overflow-auto border border-gray-200 dark:border-gray-800 font-mono max-h-80">
                        {JSON.stringify(debugData?.schedules || [], null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Stats Section */}
                <section>
                  <ScheduleStats classes={classes} currentDay={currentDay} />
                </section>

                {/* Main Grid */}
                <div className="grid lg:grid-cols-4 gap-6">
                  {/* Sidebar Filters */}
                  <div className="lg:col-span-1">
                    <div className="sticky top-24">
                      <FilterBar
                        filters={filters}
                        searchTerm={searchTerm}
                        onFilterChange={setFilters}
                        onSearchChange={setSearchTerm}
                        onClearSearch={() => setSearchTerm('')}
                      />
                    </div>
                  </div>

                  {/* Schedule Table */}
                  <div className="lg:col-span-3">
                    <ScheduleTable
                      classes={filteredClasses}
                      currentDay={currentDay}
                      nowIndicator={true}
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
