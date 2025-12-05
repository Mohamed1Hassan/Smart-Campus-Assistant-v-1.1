import { motion } from 'framer-motion';
import { Calendar, Clock, MapPin, CheckCircle, Play, AlertCircle, BookOpen, Timer, RefreshCw, ExternalLink, QrCode } from 'lucide-react';
import { useState, useEffect } from 'react';
import EmptyScheduleState from '../common/EmptyState';

interface ClassItem {
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

interface SchedulePreviewProps {
  classes: ClassItem[];
  loading?: boolean;
  onRefresh?: () => void;
}

const statusConfig = {
  upcoming: {
    icon: Clock,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100/50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200/50 dark:border-amber-700/30',
    Tag: 'Upcoming',
    pulse: false
  },
  ongoing: {
    icon: Play,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100/50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200/50 dark:border-emerald-700/30',
    Tag: 'Ongoing',
    pulse: true
  },
  completed: {
    icon: CheckCircle,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100/50 dark:bg-slate-800/50',
    borderColor: 'border-slate-200/50 dark:border-slate-700/30',
    Tag: 'Completed',
    pulse: false
  }
};

// Helper function to get today's date in Arabic and English
const getTodayDate = () => {
  const today = new Date();
  const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const englishDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const englishMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayOfWeek = today.getDay();
  const day = today.getDate();
  const month = today.getMonth();
  const year = today.getFullYear();

  return {
    arabic: `${arabicDays[dayOfWeek]}، ${day} ${arabicMonths[month]} ${year}`,
    english: `${englishDays[dayOfWeek]}, ${day} ${englishMonths[month]} ${year}`
  };
};

// Helper function to calculate time until next lecture
const getTimeUntilNextLecture = (startTime: string) => {
  if (!startTime) return null;

  const now = new Date();
  const [hours, minutes] = startTime.split(':').map(Number);
  const lectureTime = new Date();
  lectureTime.setHours(hours, minutes, 0, 0);

  const diffMs = lectureTime.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes <= 0) return null;

  if (diffMinutes < 60) {
    return `${diffMinutes} minutes`;
  } else {
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${hours}h ${mins}m`;
  }
};

export default function SchedulePreview({ classes, loading = false, onRefresh }: SchedulePreviewProps) {
  console.log('SchedulePreview classes:', classes);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Calculate lecture statistics
  const totalLectures = classes.length;
  const ongoingLectures = classes.filter(c => c.status === 'ongoing').length;
  const upcomingLectures = classes.filter(c => c.status === 'upcoming').length;
  const completedLectures = classes.filter(c => c.status === 'completed').length;

  // Get next upcoming lecture
  const currentLecture = classes.find(c => c.status === 'ongoing');
  const nextLecture = classes.find(c => c.status === 'upcoming');
  const timeUntilNext = nextLecture?.startTime ? getTimeUntilNextLecture(nextLecture.startTime) : null;

  const todayDate = getTodayDate();

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="p-8"
    >
      {/* Header skeleton */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
        <div className="flex-1">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2 w-48" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((index) => (
          <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
            </div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24" />
          </div>
        ))}
      </div>
    </motion.div>
  );

  // Show loading state
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/30 overflow-hidden"
      >
        <LoadingSkeleton />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/30 overflow-hidden flex flex-col h-full"
    >
      {/* Enhanced Header */}
      <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Calendar className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Today's Lectures</h3>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  {todayDate.english}
                </p>
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                <p className="text-xs text-gray-500 dark:text-gray-500 font-arabic" dir="rtl">
                  {todayDate.arabic}
                </p>
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-white/50 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-all shadow-sm border border-gray-200/50 dark:border-gray-600/50 group"
            title="Refresh Schedule"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          </button>
        </div>

        {/* Lecture Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-3 border border-gray-100 dark:border-gray-700/50 text-center">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Total</span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">{totalLectures}</span>
          </div>

          <div className="bg-emerald-50/60 dark:bg-emerald-900/10 rounded-xl p-3 border border-emerald-100 dark:border-emerald-800/30 text-center">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">Ongoing</span>
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{ongoingLectures}</span>
          </div>

          <div className="bg-amber-50/60 dark:bg-amber-900/10 rounded-xl p-3 border border-amber-100 dark:border-amber-800/30 text-center">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">Upcoming</span>
            <span className="text-xl font-bold text-amber-700 dark:text-amber-300">{upcomingLectures}</span>
          </div>

          <div className="bg-slate-50/60 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-700/50 text-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Done</span>
            <span className="text-xl font-bold text-slate-700 dark:text-slate-300">{completedLectures}</span>
          </div>
        </div>

        {/* Current Lecture Card */}
        {currentLecture && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-4 text-white shadow-lg shadow-emerald-500/20 relative overflow-hidden group cursor-pointer"
            onClick={() => window.location.href = '/attendance'}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm animate-pulse">
                  <Play className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-100 uppercase tracking-wide text-[10px]">Happening Now</p>
                  <p className="font-bold text-lg">{currentLecture.course}</p>
                </div>
              </div>
              <div className="text-right">
                <button className="bg-white text-emerald-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-50 transition-colors shadow-sm">
                  Join Now
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Next Lecture Countdown - Only show if no current lecture or if we want to show both */}
        {!currentLecture && timeUntilNext && nextLecture && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden group cursor-pointer"
            onClick={() => window.location.href = `/courses/${nextLecture.id}`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Timer className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-100 uppercase tracking-wide text-[10px]">Up Next</p>
                  <p className="font-bold text-lg">{nextLecture.course}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-blue-100 mb-0.5">Starts in</p>
                <p className="font-mono font-bold text-xl">{timeUntilNext}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Enhanced Table */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {classes.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar flex-1">
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-sm z-10">
                <tr className="border-b border-gray-200/50 dark:border-gray-700/50">
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Course</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Room</th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {classes.map((classItem, index) => {
                  const statusInfo = statusConfig[classItem.status];
                  const StatusIcon = statusInfo.icon;

                  return (
                    <motion.tr
                      key={classItem.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                      className={`group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors duration-200 ${statusInfo.pulse ? 'bg-emerald-50/10 dark:bg-emerald-900/5' : ''
                        }`}
                    >
                      <td className="py-4 px-6">
                        <div>
                          <span className="text-sm font-bold text-gray-900 dark:text-white block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {classItem.course}
                          </span>
                          {classItem.courseCode && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5 block">
                              {classItem.courseCode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-300 font-medium font-mono">
                            {classItem.time}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                            {classItem.room}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${statusInfo.bgColor} ${statusInfo.color} ${statusInfo.borderColor} ${statusInfo.pulse ? 'animate-pulse' : ''}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.Tag}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {classItem.status === 'ongoing' ? (
                          <button
                            onClick={() => window.location.href = '/attendance'}
                            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            Attend
                          </button>
                        ) : (
                          <button
                            onClick={() => window.location.href = `/courses/${classItem.id}`}
                            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-xs font-medium"
                          >
                            Details
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/30 dark:bg-gray-800/30">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No classes today</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-6">
              You don't have any lectures scheduled for today. Enjoy your free time!
            </p>
            <button
              onClick={() => window.location.href = '/schedule'}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-semibold flex items-center gap-2"
            >
              View Full Schedule <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      {classes.length > 0 && (
        <div className="px-6 py-4 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50 flex justify-center">
          <button
            onClick={() => window.location.href = '/schedule'}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-2 transition-colors group"
          >
            View Full Weekly Schedule
            <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
