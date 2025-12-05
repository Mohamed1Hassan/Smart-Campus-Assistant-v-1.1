import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, MapPin, Calendar, Camera, Save, Trash2,
  BookOpen, Award, TrendingUp, Shield, ArrowLeft, CheckCircle, AlertCircle, Edit2
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '../components/common/DashboardLayout';
import ProfileForm from '../components/ProfileForm';
import AccountSettings from '../components/AccountSettings';
import AcademicSummary from '../components/AcademicSummary';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/common/ToastProvider';
import { apiClient } from '../services/api';
import ConfirmModal from '../components/ConfirmModal';
import { useFormValidation } from '../hooks/useFormValidation';
import { validators } from '../utils/validation.frontend';
import { MAJOR_NAMES } from '../utils/departmentUtils';

const initialProfile = {
  id: "",
  name: "",
  email: "",
  phone: "",
  dob: "",
  address: "",
  major: "",
  attendancePercent: 0,
  gpa: 0,
  notificationsEnabled: true,
  avatarUrl: null as string | null,
  emergencyContact: ""
};

const PROFILE_VALIDATION_RULES = {
  name: [validators.required('Full name is required'), validators.minLength(2, 'Name must be at least 2 characters')],
  email: [validators.required('Email is required'), validators.email()],
  phone: [validators.required('Phone number is required'), validators.phone()],
  dob: [validators.required('Date of birth is required'), validators.date()],
  address: [validators.required('Address is required'), validators.minLength(10, 'Please provide a complete address')],
  emergencyContact: [validators.required('Emergency contact is required'), validators.minLength(5, 'Please provide full contact information')],
};

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const { success: showSuccess, error: showError, info: showInfo, warning: showWarning } = useToast();
  const queryClient = useQueryClient();
  const DEV = import.meta.env?.DEV;

  // Initialize profile from AuthContext immediately
  const authProfileFallback = useMemo(() => {
    if (!user) return initialProfile;
    return {
      id: user.universityId,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: '',
      dob: '',
      address: '',
      major: '',
      attendancePercent: 0,
      gpa: 0,
      notificationsEnabled: true,
      avatarUrl: null,
      emergencyContact: ''
    };
  }, [user]);

  const [isEditing, setIsEditing] = useState(false);
  const [originalProfile, setOriginalProfile] = useState(authProfileFallback);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const successBannerRef = useRef<HTMLDivElement>(null);

  // Full profile state
  const [fullProfile, setFullProfile] = useState(authProfileFallback);

  // Academic data state
  const [academicData, setAcademicData] = useState({
    currentCourses: 0,
    upcomingExams: 0
  });

  // Form validation
  const {
    values: formValues,
    errors,
    touched,
    isValid,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setValue,
  } = useFormValidation({
    initialValues: {
      name: authProfileFallback.name,
      email: authProfileFallback.email,
      phone: authProfileFallback.phone || '',
      dob: authProfileFallback.dob || '',
      address: authProfileFallback.address || '',
      emergencyContact: authProfileFallback.emergencyContact || '',
    },
    validationRules: PROFILE_VALIDATION_RULES,
    onSubmit: async (values) => {
      setIsLoading(true);
      setSaveStatus('idle');
      try {
        const updateData: any = {
          name: values.name,
          email: values.email,
          phone: values.phone,
          dob: values.dob,
          address: values.address,
          emergencyContact: values.emergencyContact,
        };

        if (avatarFile && avatarPreview) {
          updateData.avatarUrl = avatarPreview;
        }

        const response = await apiClient.put('/api/users/profile', updateData);

        if (response.success) {
          setSaveStatus('success');
          setLastUpdated(new Date());
          addToast('Profile updated successfully!', 'success');
          const updatedProfile = { ...fullProfile, ...values, avatarUrl: avatarPreview || fullProfile.avatarUrl };
          setFullProfile(updatedProfile);
          setOriginalProfile(updatedProfile);
          setIsEditing(false);

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['student-profile'] });
        } else {
          throw new Error(response.message || 'Failed to update profile');
        }
      } catch (error: any) {
        setSaveStatus('error');
        addToast(error.message || 'Failed to update profile', 'error');
      } finally {
        setIsLoading(false);
      }
    },
  });

  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    switch (type) {
      case 'success': showSuccess(message, { showProgress: true }); break;
      case 'error': showError(message, { showProgress: true }); break;
      case 'warning': showWarning(message, { showProgress: true }); break;
      case 'info': showInfo(message, { showProgress: true }); break;
    }
  };

  const safe = (v: any, fallback: any) => (v !== undefined && v !== null && v !== '' ? v : fallback);

  // Fetch profile data using useQuery
  const { data: profileData } = useQuery({
    queryKey: ['student-profile', user?.universityId],
    queryFn: async () => {
      if (!isAuthenticated || !user?.universityId) return null;
      const response = await apiClient.get('/api/users/profile');
      if (response.success && response.data) {
        const userData = response.data.user || response.data;
        const currentAuthFallback = user ? {
          id: user.universityId,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: '',
          dob: '',
          address: '',
          major: '',
          attendancePercent: 0,
          gpa: 0,
          notificationsEnabled: true,
          avatarUrl: null,
          emergencyContact: ''
        } : initialProfile;

        return {
          id: currentAuthFallback.id,
          name: currentAuthFallback.name,
          email: currentAuthFallback.email,
          phone: safe(userData.phone, currentAuthFallback.phone),
          dob: safe(userData.dob, currentAuthFallback.dob),
          address: safe(userData.address, currentAuthFallback.address),
          major: safe(userData.major, currentAuthFallback.major),
          attendancePercent: safe(userData.attendancePercent, currentAuthFallback.attendancePercent),
          gpa: safe(userData.gpa, currentAuthFallback.gpa),
          notificationsEnabled: userData.notificationsEnabled ?? currentAuthFallback.notificationsEnabled,
          avatarUrl: safe(userData.avatarUrl, currentAuthFallback.avatarUrl),
          emergencyContact: safe(userData.emergencyContact, currentAuthFallback.emergencyContact)
        };
      }
      return null;
    },
    enabled: !!isAuthenticated && !!user?.universityId,
    staleTime: 5 * 60 * 1000,
  });

  // Sync profile data with local state
  useEffect(() => {
    if (profileData) {
      setFullProfile(profileData);
      setValue('name', profileData.name);
      setValue('email', profileData.email);
      setValue('phone', profileData.phone || '');
      setValue('dob', profileData.dob || '');
      setValue('address', profileData.address || '');
      setValue('emergencyContact', profileData.emergencyContact || '');
      setOriginalProfile(profileData);
    }
  }, [profileData, setValue]);

  // Fetch academic data using useQuery
  const { data: fetchedAcademicData } = useQuery({
    queryKey: ['student-academic-data', user?.universityId],
    queryFn: async () => {
      if (!isAuthenticated || !user?.universityId) return { currentCourses: 0, upcomingExams: 0 };

      try {
        const coursesResponse = await apiClient.get('/api/courses/enrolled');
        if (coursesResponse.success && coursesResponse.data) {
          const enrolledCourses = Array.isArray(coursesResponse.data)
            ? coursesResponse.data
            : (coursesResponse.data.courses || coursesResponse.data.enrollments || []);

          return {
            currentCourses: enrolledCourses.length,
            upcomingExams: 0 // TODO: Add upcoming exams API endpoint
          };
        }
      } catch (error) {
        console.error('Error fetching academic data:', error);
      }
      return { currentCourses: 0, upcomingExams: 0 };
    },
    enabled: !!isAuthenticated && !!user?.universityId,
    staleTime: 5 * 60 * 1000,
  });

  // Sync academic data
  useEffect(() => {
    if (fetchedAcademicData) {
      setAcademicData(fetchedAcademicData);
    }
  }, [fetchedAcademicData]);

  const handleToggleEdit = () => {
    if (isEditing) {
      reset();
      setAvatarFile(null);
      setAvatarPreview(null);
      setSaveStatus('idle');
    }
    setIsEditing(!isEditing);
  };

  const handleAvatarChange = (file: File | null) => {
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleNotificationToggle = (enabled: boolean) => {
    setFullProfile(prev => ({ ...prev, notificationsEnabled: enabled }));
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(false);
    addToast('Account deletion requested. This feature requires backend implementation.', 'warning');
  };

  const achievements = [
    { label: 'Dean\'s List', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    { label: 'Perfect Attendance', color: 'bg-green-100 text-green-800 border-green-200' },
    { label: 'Class Representative', color: 'bg-blue-100 text-blue-800 border-blue-200' }
  ];

  return (
    <DashboardLayout
      userName={fullProfile.name}
      userAvatar={avatarPreview || fullProfile.avatarUrl || undefined}
      userType="student"
    >
      <div className="max-w-7xl mx-auto pb-12">
        {/* Cover Image Section */}
        <div className="relative h-48 sm:h-64 rounded-b-3xl bg-gradient-to-r from-indigo-600 to-purple-700 overflow-hidden shadow-lg -mt-6 -mx-4 sm:-mx-6 lg:-mx-8 mb-16 sm:mb-20">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1562774053-701939374585?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>

          <div className="absolute top-6 left-4 sm:left-6 lg:left-8 z-10">
            <Link
              to="/student-dashboard"
              className="flex items-center gap-2 text-white/90 hover:text-white transition-colors bg-black/20 backdrop-blur-sm px-3 py-1.5 sm:px-4 sm:py-2 rounded-full hover:bg-black/30 text-sm sm:text-base"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-medium">Back</span>
            </Link>
          </div>

          {isEditing && (
            <button className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 lg:right-8 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full flex items-center gap-2 transition-all border border-white/30 text-xs sm:text-sm">
              <Camera className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="font-medium">Change Cover</span>
            </button>
          )}
        </div>

        {/* Profile Header Content */}
        <div className="px-4 sm:px-6 lg:px-8 relative">
          <div className="flex flex-col lg:flex-row items-center lg:items-end gap-4 sm:gap-6 -mt-28 sm:-mt-32 mb-8 text-center lg:text-left">
            <div className="relative group">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-white dark:border-gray-900 shadow-xl overflow-hidden bg-white dark:bg-gray-800 relative z-10">
                {avatarPreview || fullProfile.avatarUrl ? (
                  <img
                    src={avatarPreview || fullProfile.avatarUrl || ''}
                    alt={fullProfile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 text-indigo-500 dark:text-indigo-300">
                    <User className="w-16 h-16 sm:w-20 sm:h-20" />
                  </div>
                )}

                {isEditing && (
                  <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20">
                    <Camera className="w-6 h-6 sm:w-8 sm:h-8 mb-1" />
                    <span className="text-[10px] sm:text-xs font-medium">Change</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg"
                      className="hidden"
                      onChange={(e) => handleAvatarChange(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>
              <div className="absolute bottom-2 right-2 z-20 w-5 h-5 sm:w-6 sm:h-6 bg-emerald-500 border-2 border-white dark:border-gray-900 rounded-full animate-pulse"></div>
            </div>

            <div className="flex-1 pt-2 lg:pt-0 lg:pb-4 w-full">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-1">
                    {fullProfile.name}
                  </h1>
                  <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 flex items-center justify-center lg:justify-start gap-2">
                    <BookOpen className="w-4 h-4" />
                    {(fullProfile.major ? (MAJOR_NAMES[fullProfile.major] || fullProfile.major) : 'Major not set')} • ID: {fullProfile.id}
                  </p>
                </div>

                <div className="flex items-center justify-center lg:justify-end gap-3 w-full lg:w-auto">
                  {!isEditing ? (
                    <button
                      onClick={handleToggleEdit}
                      className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 font-medium flex items-center justify-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit Profile
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        onClick={handleToggleEdit}
                        className="flex-1 sm:flex-none px-6 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={(e) => handleSubmit(e as any)}
                        disabled={isSubmitting}
                        className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 font-medium flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        {isSubmitting ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Success/Error Messages */}
          <AnimatePresence>
            {saveStatus === 'success' && (
              <motion.div
                ref={successBannerRef}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-8 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3"
              >
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-green-800 dark:text-green-200 font-medium">Profile updated successfully!</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Personal Info & Achievements */}
            <div className="space-y-8">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <User className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Personal Information</h2>
                </div>
                <ProfileForm
                  profile={{
                    name: formValues.name,
                    email: formValues.email,
                    phone: formValues.phone,
                    dob: formValues.dob,
                    address: formValues.address,
                    emergencyContact: formValues.emergencyContact,
                  }}
                  isEditing={isEditing}
                  onChange={handleChange}
                  errors={errors}
                  touched={touched}
                  onBlur={handleBlur}
                  chromeless
                />
              </div>

              {/* Achievements Card */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-12 -mb-12 blur-xl"></div>

                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 relative z-10">
                  <Award className="w-5 h-5" />
                  Achievements
                </h3>

                <div className="flex flex-wrap gap-2 relative z-10">
                  {achievements.map((achievement, index) => (
                    <span key={index} className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-sm font-medium border border-white/10">
                      {achievement.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle & Right Columns - Stats & Settings */}
            <div className="lg:col-span-2 space-y-8">
              <AcademicSummary
                currentCourses={academicData.currentCourses}
                upcomingExams={academicData.upcomingExams}
              />

              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Account Settings</h3>
                <AccountSettings
                  notificationsEnabled={fullProfile.notificationsEnabled}
                  onNotificationToggle={handleNotificationToggle}
                  userRole="STUDENT"
                />

                <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
                  <h4 className="text-sm font-bold text-red-600 mb-4">Danger Zone</h4>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-all text-sm font-medium border border-red-200 dark:border-red-800 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Account"
        message="Are you sure you want to delete your account? This action cannot be undone."
        confirmText="Delete Account"
        cancelText="Cancel"
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteModal(false)}
      />
    </DashboardLayout >
  );
}
