import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, MapPin, Clock, Shield, Users, Camera, Smartphone,
  AlertTriangle, Info, CheckCircle, XCircle, Save, RefreshCw, Calendar,
  HelpCircle, Navigation2, X, ChevronRight, Sparkles, Layout
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/common/DashboardLayout';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../contexts/AuthContext';
import { useAttendanceSessions } from '../hooks/useAttendanceSessions';
import { apiClient } from '../services/api';
import { useToast } from '../components/common/ToastProvider';

const DEV = import.meta.env?.DEV;

interface Course {
  id: number;
  courseName: string;
  courseCode: string;
  enrollments?: Array<{ studentId: number }>;
}

interface FormErrors {
  courseId?: string;
  title?: string;
  description?: string;
  startTime?: string;
  duration?: string;
  locationName?: string;
  latitude?: string;
  longitude?: string;
  radius?: string;
  gracePeriod?: string;
  maxAttempts?: string;
  riskThreshold?: string;
}

export default function ProfessorAttendanceCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success, error: showError, info, warning: showWarning } = useToast();

  const {
    createSession,
    isCreating,
    createError,
    clearErrors
  } = useAttendanceSessions();

  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    courseId: '',
    title: '',
    description: '',
    startTime: '',
    duration: 2,
    location: {
      name: '',
      latitude: '',
      longitude: '',
      radius: 50
    },
    security: {
      isLocationRequired: true,
      isPhotoRequired: false,
      isDeviceCheckRequired: true,
      fraudDetectionEnabled: true,
      gracePeriod: 5,
      maxAttempts: 3,
      riskThreshold: 70
    }
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [currentStep, setCurrentStep] = useState(0);

  // Fetch courses
  useEffect(() => {
    const fetchCourses = async () => {
      if (!user?.id) return;
      setIsLoadingCourses(true);
      try {
        const professorId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
        const response = await apiClient.get('/api/courses', { params: { professorId } });
        if (response.success && Array.isArray(response.data)) {
          setCourses(response.data.map((c: any) => ({
            id: Number(c.id),
            courseName: String(c.courseName).trim(),
            courseCode: String(c.courseCode).trim(),
            enrollments: c.enrollments || []
          })));
        }
      } catch (error) {
        console.error('Error fetching courses:', error);
      } finally {
        setIsLoadingCourses(false);
      }
    };
    fetchCourses();
  }, [user?.id]);

  // Validation
  const validateField = useCallback((field: string, value: any): string | undefined => {
    switch (field) {
      case 'courseId': return !value ? 'Course is required' : undefined;
      case 'title':
        if (!value) return 'Title is required';
        if (value.length < 3) return 'Title too short';
        return undefined;
      case 'startTime':
        if (!value) return 'Start time is required';
        if (new Date(value) <= new Date()) return 'Must be in future';
        return undefined;
      case 'duration': return !value ? 'Duration is required' : undefined;
      default: return undefined;
    }
  }, []);

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...prev[parent as keyof typeof prev], [child]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }

    if (touched[field]) {
      setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const value = field.includes('.')
      ? (formData as any)[field.split('.')[0]][field.split('.')[1]]
      : (formData as any)[field];
    setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
  };

  const handleQuickTimeSelect = (type: 'now' | 'today' | 'tomorrow') => {
    const now = new Date();
    let targetDate = new Date();
    if (type === 'now') targetDate = new Date(now.getTime() + 5 * 60 * 1000);
    else if (type === 'today') targetDate.setHours(14, 0, 0, 0);
    else if (type === 'tomorrow') {
      targetDate.setDate(now.getDate() + 1);
      targetDate.setHours(9, 0, 0, 0);
    }

    // Format: YYYY-MM-DDTHH:mm
    const formatted = new Date(targetDate.getTime() - (targetDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    handleInputChange('startTime', formatted);
  };

  const handleSubmit = async () => {
    const newErrors: FormErrors = {};
    ['courseId', 'title', 'startTime', 'duration'].forEach(field => {
      const error = validateField(field, (formData as any)[field]);
      if (error) newErrors[field as keyof FormErrors] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched({ courseId: true, title: true, startTime: true, duration: true });
      showError('Please fix validation errors');
      return;
    }

    const sessionData = {
      courseId: parseInt(formData.courseId),
      courseName: courses.find(c => c.id === parseInt(formData.courseId))?.courseName || '',
      title: formData.title,
      description: formData.description,
      startTime: new Date(formData.startTime),
      endTime: new Date(new Date(formData.startTime).getTime() + formData.duration * 60 * 60 * 1000),
      location: {
        latitude: parseFloat(formData.location.latitude) || 0,
        longitude: parseFloat(formData.location.longitude) || 0,
        radius: formData.location.radius,
        name: formData.location.name
      },
      security: formData.security
    };

    const result = await createSession(sessionData);
    if (result) {
      success('Session created successfully');
      navigate('/professor-attendance');
    }
  };

  const steps = [
    { id: 0, title: 'Basic Info', icon: Layout },
    { id: 1, title: 'Schedule', icon: Clock },
    { id: 2, title: 'Location', icon: MapPin },
    { id: 3, title: 'Security', icon: Shield },
  ];

  const selectedCourse = courses.find(c => c.id === parseInt(formData.courseId));

  return (
    <DashboardLayout
      userName={user ? `${user.firstName} ${user.lastName}` : "Professor"}
      userType="professor"
    >
      <div className="max-w-7xl mx-auto h-[calc(100vh-5rem)] md:h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 flex-shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Session</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure a new attendance session</p>
          </div>
        </div>

        <div className="flex-1 flex gap-8 min-h-0">
          {/* Left Column - Form */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Stepper */}
            <div className="flex items-center justify-between mb-6 md:mb-8 px-1 md:px-2 flex-shrink-0">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center flex-1 last:flex-none">
                  <div
                    className={`flex items-center gap-2 cursor-pointer group ${index <= currentStep ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'
                      }`}
                    onClick={() => setCurrentStep(index)}
                  >
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 transition-all ${index <= currentStep
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                      }`}>
                      <step.icon className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <span className="font-medium hidden md:block text-sm md:text-base">{step.title}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-2 md:mx-4 transition-colors ${index < currentStep ? 'bg-purple-200 dark:bg-purple-900' : 'bg-gray-100 dark:bg-gray-800'
                      }`} />
                  )}
                </div>
              ))}
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto pr-2 overflow-x-hidden">
              <AnimatePresence mode="wait">
                {currentStep === 0 && (
                  <motion.div
                    key="step0"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="bg-white dark:bg-cardDark rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Session Details</h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course</label>
                          <select
                            value={formData.courseId}
                            onChange={(e) => handleInputChange('courseId', e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl border bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all ${errors.courseId ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 dark:border-gray-700'
                              }`}
                          >
                            <option value="">Select a course...</option>
                            {courses.map(course => (
                              <option key={course.id} value={course.id}>
                                {course.courseName} ({course.courseCode})
                              </option>
                            ))}
                          </select>
                          {errors.courseId && <p className="text-red-500 text-xs mt-1">{errors.courseId}</p>}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                          <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => handleInputChange('title', e.target.value)}
                            placeholder="e.g. Week 5: Neural Networks"
                            className={`w-full px-4 py-3 rounded-xl border bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all ${errors.title ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 dark:border-gray-700'
                              }`}
                          />
                          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
                          <textarea
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            placeholder="Brief description of the session topics..."
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="bg-white dark:bg-cardDark rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Timing</h3>

                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Time</label>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <button onClick={() => handleQuickTimeSelect('now')} className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs rounded-full hover:bg-purple-100 transition-colors">
                              Starts in 5 min
                            </button>
                            <button onClick={() => handleQuickTimeSelect('today')} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs rounded-full hover:bg-gray-200 transition-colors">
                              Today 2:00 PM
                            </button>
                            <button onClick={() => handleQuickTimeSelect('tomorrow')} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs rounded-full hover:bg-gray-200 transition-colors">
                              Tomorrow 9:00 AM
                            </button>
                          </div>
                          <input
                            type="datetime-local"
                            value={formData.startTime}
                            onChange={(e) => handleInputChange('startTime', e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl border bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all ${errors.startTime ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 dark:border-gray-700'
                              }`}
                          />
                          {errors.startTime && <p className="text-red-500 text-xs mt-1">{errors.startTime}</p>}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Duration (Hours)</label>
                          <div className="flex items-center gap-4">
                            <input
                              type="range"
                              min="0.5"
                              max="4"
                              step="0.5"
                              value={formData.duration}
                              onChange={(e) => handleInputChange('duration', parseFloat(e.target.value))}
                              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                            />
                            <span className="w-16 text-center font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">
                              {formData.duration}h
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="bg-white dark:bg-cardDark rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Location Settings</h3>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.security.isLocationRequired}
                            onChange={(e) => handleInputChange('security.isLocationRequired', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                        </label>
                      </div>

                      <div className={`space-y-4 transition-opacity ${!formData.security.isLocationRequired ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location Name</label>
                          <input
                            type="text"
                            value={formData.location.name}
                            onChange={(e) => handleInputChange('location.name', e.target.value)}
                            placeholder="e.g. Building A, Room 101"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitude</label>
                            <input
                              type="number"
                              value={formData.location.latitude}
                              onChange={(e) => handleInputChange('location.latitude', e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitude</label>
                            <input
                              type="number"
                              value={formData.location.longitude}
                              onChange={(e) => handleInputChange('location.longitude', e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (!navigator.geolocation) {
                              showError('Geolocation is not supported by your browser');
                              return;
                            }

                            const options = {
                              enableHighAccuracy: true,
                              timeout: 15000,
                              maximumAge: 0
                            };

                            const successCallback = (pos: GeolocationPosition) => {
                              handleInputChange('location.latitude', pos.coords.latitude);
                              handleInputChange('location.longitude', pos.coords.longitude);

                              if (pos.coords.accuracy > 100) {
                                showWarning(`Low accuracy detected (${Math.round(pos.coords.accuracy)}m). Try moving to an open area or entering coordinates manually.`);
                              } else {
                                success(`Location updated (Accuracy: ${Math.round(pos.coords.accuracy)}m)`);
                              }
                            };

                            const errorCallback = (err: GeolocationPositionError) => {
                              console.error('Location error:', err);
                              let message = 'Failed to get location.';

                              switch (err.code) {
                                case 1: // PERMISSION_DENIED
                                  message = 'Location permission denied. Please enable location access in your browser settings (click the lock icon in the URL bar).';
                                  // Could trigger a modal or specialized UI here if needed
                                  break;
                                case 2: // POSITION_UNAVAILABLE
                                  message = 'Location information is unavailable. Check your device GPS settings.';
                                  break;
                                case 3: // TIMEOUT
                                  message = 'Location request timed out. Please retry in a better signal area.';
                                  break;
                                default:
                                  message = `Location error: ${err.message}`;
                              }
                              showError(message);
                            };

                            info('Getting high-accuracy location... Please wait.');
                            navigator.geolocation.getCurrentPosition(successCallback, errorCallback, options);
                          }}
                          className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                        >
                          <MapPin className="w-4 h-4" /> Use Current Location
                        </button>

                        {formData.location.latitude && formData.location.longitude && (
                          <a
                            href={`https://www.google.com/maps?q=${formData.location.latitude},${formData.location.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 ml-4"
                          >
                            <Navigation2 className="w-4 h-4" /> View on Map
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {currentStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="bg-white dark:bg-cardDark rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                      <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Security Measures</h3>

                      <div className="space-y-6">
                        {[
                          { key: 'isPhotoRequired', label: 'Require Photo Verification', icon: Camera, desc: 'Students must take a selfie to check in' },
                          { key: 'isDeviceCheckRequired', label: 'Device Fingerprinting', icon: Smartphone, desc: 'Prevent checking in from multiple accounts on one device' },
                          { key: 'fraudDetectionEnabled', label: 'AI Fraud Detection', icon: Shield, desc: 'Analyze patterns to detect suspicious behavior' },
                        ].map((item) => (
                          <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center text-gray-500 shadow-sm">
                                <item.icon className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{item.label}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                              </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={(formData.security as any)[item.key]}
                                onChange={(e) => handleInputChange(`security.${item.key}`, e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                disabled={currentStep === 0}
                className={`px-6 py-2.5 rounded-xl font-medium transition-colors ${currentStep === 0
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
              >
                Back
              </button>

              {currentStep < steps.length - 1 ? (
                <button
                  onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
                  className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  Next Step <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isCreating}
                  className="px-8 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all flex items-center gap-2"
                >
                  {isCreating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Create Session
                </button>
              )}
            </div>
          </div>

          {/* Right Column - Live Preview */}
          <div className="hidden lg:block w-[380px] flex-shrink-0">
            <div className="sticky top-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Live Preview</h3>

              <div className="bg-white dark:bg-cardDark rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden relative">
                {/* Phone Frame / Card Preview */}
                <div className="h-40 bg-gradient-to-br from-purple-600 to-indigo-600 p-6 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl" />
                  <div className="relative z-10">
                    <span className="inline-block px-2 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-medium mb-3">
                      {selectedCourse?.courseCode || 'CS-101'}
                    </span>
                    <h2 className="text-xl font-bold leading-tight mb-1">
                      {formData.title || 'Session Title'}
                    </h2>
                    <p className="text-purple-100 text-sm truncate">
                      {selectedCourse?.courseName || 'Select a course'}
                    </p>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Time</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formData.startTime ? new Date(formData.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{formData.duration} hours duration</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Location</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formData.location.name || 'No location set'}
                      </p>
                      {formData.security.isLocationRequired && (
                        <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Geofencing Active
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 mb-3">Security Features</p>
                    <div className="flex gap-2 flex-wrap">
                      {formData.security.isPhotoRequired && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
                          <Camera className="w-3 h-3" /> Photo
                        </span>
                      )}
                      {formData.security.isDeviceCheckRequired && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
                          <Smartphone className="w-3 h-3" /> Device
                        </span>
                      )}
                      {formData.security.fraudDetectionEnabled && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> AI Fraud
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout >
  );
}
