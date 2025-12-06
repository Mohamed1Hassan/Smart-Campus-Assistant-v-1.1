import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, BookOpen, Users, Calendar, Search, X,
  Filter, MoreVertical, Trash2, Edit, ExternalLink,
  GraduationCap, Clock, ChevronRight, LayoutGrid, List
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '../components/common/DashboardLayout';
import AddCourseModal from '../components/professor/AddCourseModal';
import UploadModal from '../components/professor/UploadModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/common/ToastProvider';
import { apiClient } from '../services/api';
import { getCourseImage } from '../utils/courseImages';

const DEV = import.meta.env?.DEV;

interface Course {
  id: string;
  name: string;
  code: string;
  studentCount: number;
  maxStudents: number;
  scheduleTime?: string;
  professorName?: string;
  createdAt?: string;
  updatedAt?: string;
  description?: string;
  coverImage?: string;
}

export default function MyCourses() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const professorId = typeof user?.id === 'string' ? parseInt(user.id) : user?.id;

  // Fetch courses using React Query
  const { data: courses = [], isLoading, isPending, isError, refetch } = useQuery({
    queryKey: ['professor-courses', professorId, 'full'],
    queryFn: async () => {
      console.log('Fetching courses for professor:', professorId);
      if (!isAuthenticated || !professorId) return [];

      const response = await apiClient.get('/api/courses', {
        params: { professorId }
      });

      if (response.success && Array.isArray(response.data)) {
        return response.data.map((course: any) => ({
          id: String(course.id),
          name: course.courseName,
          code: course.courseCode,
          studentCount: course._count?.enrollments ?? (Array.isArray(course.enrollments) ? course.enrollments.length : (course.enrolledCount || 0)),
          maxStudents: course.capacity || 500,
          scheduleTime: course.schedules?.[0]
            ? `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][course.schedules[0].dayOfWeek]} ${course.schedules[0].startTime}`
            : undefined,
          professorName: course.professor ? `${course.professor.firstName} ${course.professor.lastName}` : undefined,
          createdAt: course.createdAt,
          updatedAt: course.updatedAt,
          description: course.description,
          coverImage: getCourseImage(course.courseName, course.id)
        }));
      }
      throw new Error('Invalid response format');
    },
    enabled: !!isAuthenticated && !!professorId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 2,
    refetchOnMount: true
  });

  // Debug effect
  useMemo(() => {
    console.log('MyCourses State:', {
      isAuthenticated,
      professorId,
      isLoading,
      isPending,
      hasData: courses.length > 0
    });
  }, [isAuthenticated, professorId, isLoading, isPending, courses.length]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (courseId: string) => {
      await apiClient.delete(`/api/courses/${courseId}`);
      return courseId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professor-courses'] });
      success('Course deleted successfully');
    },
    onError: () => {
      showError('Failed to delete course');
    }
  });

  const handleAddCourse = async (newCourseData: any) => {
    try {
      const response = await apiClient.post('/api/courses', {
        ...newCourseData,
        courseCode: newCourseData.code,
        courseName: newCourseData.name,
        professorId
      });

      if (response.success) {
        success('Course created successfully');
        queryClient.invalidateQueries({ queryKey: ['professor-courses'] });
        setShowAddModal(false);
      }
    } catch (error) {
      showError('Failed to create course');
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;
    deleteMutation.mutate(courseId);
  };

  const filteredCourses = useMemo(() => {
    return courses.filter((course: Course) => {
      const matchesSearch = course.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.code?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [courses, searchTerm]);

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
      transition: { duration: 0.5 }
    }
  };

  // Determine if we are effectively loading
  // In v5, isPending is true if there is no data yet (status === 'pending')
  // isLoading is true only if status === 'pending' AND isFetching is true
  // We want to show loading state if we are pending (no data) or if auth is loading
  const isEffectiveLoading = isPending || isAuthLoading || (isAuthenticated && !professorId);

  return (
    <DashboardLayout
      userName={user ? `${user.firstName} ${user.lastName}` : "Professor"}
      userType="professor"
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto space-y-8 pb-12"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20"
            >
              <BookOpen className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">My Courses</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Manage your curriculum and students.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
            >
              <Plus className="w-5 h-5" />
              Add Course
            </motion.button>
          </div>
        </motion.div>

        {/* Filters & Search */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-cardDark p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Error State */}
        {isError ? (
          <motion.div
            variants={itemVariants}
            className="text-center py-12 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/20"
          >
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <ExternalLink className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Failed to load courses</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
              We couldn't fetch your courses. This might be due to a network issue or server timeout.
            </p>
            <button
              onClick={() => refetch()}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-red-500/20"
            >
              Try Again
            </button>
          </motion.div>
        ) : isEffectiveLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredCourses.length > 0 ? (
          <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
            {filteredCourses.map((course: Course) => (
              <motion.div
                key={course.id}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className={`group bg-white dark:bg-cardDark rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 ${viewMode === 'list' ? 'flex flex-col sm:flex-row sm:items-center p-4 gap-4 sm:gap-6' : ''}`}
              >
                {/* Card Header (Grid Mode) */}
                {viewMode === 'grid' && (
                  <div className="h-40 relative group-hover:scale-105 transition-transform duration-500">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />
                    <img
                      src={(course as any).coverImage || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1000&auto=format&fit=crop'}
                      alt={course.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 z-20 p-6 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-white border border-white/30">
                          {course.code}
                        </span>
                        <div className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCourse(course.id);
                            }}
                            className="p-2 bg-black/40 backdrop-blur-md rounded-lg text-white/90 hover:bg-red-500/80 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white line-clamp-2 leading-tight drop-shadow-md">
                        {course.name}
                      </h3>
                    </div>
                  </div>
                )}

                {/* Card Content */}
                <div className={`p-6 ${viewMode === 'list' ? 'flex-1 p-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0' : ''}`}>
                  {viewMode === 'list' && (
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 font-bold">
                        {course.code.substring(0, 2)}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{course.name}</h3>
                        <p className="text-sm text-gray-500">{course.code}</p>
                      </div>
                    </div>
                  )}

                  <div className={`space-y-4 ${viewMode === 'list' ? 'flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-8 space-y-0 sm:mr-8' : ''}`}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>Students</span>
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {course.studentCount} / {course.maxStudents}
                      </span>
                    </div>

                    {course.scheduleTime && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span>Schedule</span>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {course.scheduleTime}
                        </span>
                      </div>
                    )}

                    {viewMode === 'grid' && (
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${(course.studentCount / course.maxStudents) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {viewMode === 'grid' && (
                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <button
                        onClick={() => navigate(`/professor-courses/${course.id}`)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        View Details <ChevronRight className="w-4 h-4" />
                      </button>
                      <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {viewMode === 'list' && (
                    <div className="flex items-center gap-2 self-end sm:self-auto mt-2 sm:mt-0">
                      <button
                        onClick={() => navigate(`/professor-courses/${course.id}`)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-blue-600"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            variants={itemVariants}
            className="text-center py-20 bg-white dark:bg-cardDark rounded-3xl border border-dashed border-gray-200 dark:border-gray-700"
          >
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No courses found</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
              Get started by creating your first course. You can manage students, attendance, and materials.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20"
            >
              Create First Course
            </motion.button>
          </motion.div>
        )}
      </motion.div>

      <AddCourseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddCourse={handleAddCourse}
      />
    </DashboardLayout >
  );
}
