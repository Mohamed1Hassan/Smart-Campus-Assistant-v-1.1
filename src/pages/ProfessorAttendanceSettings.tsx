import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Save, Shield, MapPin, Camera, Smartphone, Bell, Settings, AlertTriangle, CheckCircle,
  Info, HelpCircle, Download, Upload, RotateCcw, Monitor, Clock, FileJson, X, ChevronRight,
  Eye, EyeOff, RefreshCw, CheckCircle2, Loader2, Search, Lock, Zap, Layout
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/common/DashboardLayout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useToast } from '../components/common/ToastProvider';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import { isDemo } from '@/utils/demoMode';

// Types
interface SettingsState {
  security: any;
  notifications: any;
  location: any;
  device: any;
  photo: any;
  time: any;
  fraudDetection: any;
}

type PresetType = 'standard' | 'high-security' | 'low-security' | 'custom';

const PRESETS = {
  'standard': {
    name: 'Standard',
    description: 'Balanced security for most classes',
    icon: Shield,
    color: 'blue'
  },
  'high-security': {
    name: 'High Security',
    description: 'Strict validation for exams',
    icon: Lock,
    color: 'purple'
  },
  'low-security': {
    name: 'Low Security',
    description: 'Minimal friction for lectures',
    icon: Zap,
    color: 'green'
  }
};

const SECTIONS = [
  { id: 'security', label: 'General Security', icon: Shield },
  { id: 'location', label: 'Location & Geofencing', icon: MapPin },
  { id: 'device', label: 'Device Restrictions', icon: Smartphone },
  { id: 'photo', label: 'Photo Verification', icon: Camera },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

export default function ProfessorAttendanceSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success, error: showError, info } = useToast();

  const [activeSection, setActiveSection] = useState('security');
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('custom');
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsState>({
    security: {
      defaultGracePeriod: 5,
      defaultMaxAttempts: 3,
      defaultRiskThreshold: 70,
    },
    notifications: {
      enableEmailNotifications: true,
      enablePushNotifications: true,
      notifyOnFraudDetection: true,
    },
    location: {
      defaultRadius: 50,
      enableGeofencing: true,
      requireLocationAccuracy: true,
    },
    device: {
      enableDeviceFingerprinting: true,
      enableDeviceSharingDetection: true,
    },
    photo: {
      requirePhotoVerification: false,
      enableFaceDetection: false,
    },
    time: {
      enableTimeValidation: true,
    },
    fraudDetection: {
      enableMLBasedDetection: true,
      fraudDetectionThreshold: 70,
    }
  });

  // Load settings from API
  const loadSettings = useCallback(async () => {
    try {
      const response = await apiClient.get('/professor/settings');
      if (response.success && response.data) {
        // Merge API data with default state to ensure all fields exist
        setSettings(prev => ({
          ...prev,
          ...response.data
        }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Don't show error toast on initial load to avoid annoyance if it's just missing settings
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSettingChange = (category: string, setting: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof SettingsState],
        [setting]: value
      }
    }));
    setSelectedPreset('custom');
  };

  const applyPreset = (preset: PresetType) => {
    if (preset === 'custom') return;

    // Define preset values
    const presetValues: any = {
      'standard': {
        security: { defaultGracePeriod: 5, defaultMaxAttempts: 3, defaultRiskThreshold: 70 },
        location: { defaultRadius: 50, enableGeofencing: true },
        device: { enableDeviceFingerprinting: true },
        photo: { requirePhotoVerification: false }
      },
      'high-security': {
        security: { defaultGracePeriod: 2, defaultMaxAttempts: 2, defaultRiskThreshold: 85 },
        location: { defaultRadius: 20, enableGeofencing: true },
        device: { enableDeviceFingerprinting: true },
        photo: { requirePhotoVerification: true }
      },
      'low-security': {
        security: { defaultGracePeriod: 15, defaultMaxAttempts: 5, defaultRiskThreshold: 50 },
        location: { defaultRadius: 100, enableGeofencing: false },
        device: { enableDeviceFingerprinting: false },
        photo: { requirePhotoVerification: false }
      }
    };

    const updates = presetValues[preset];
    if (updates) {
      setSettings(prev => {
        const newSettings = { ...prev };
        Object.keys(updates).forEach(cat => {
          newSettings[cat as keyof SettingsState] = {
            ...newSettings[cat as keyof SettingsState],
            ...updates[cat]
          };
        });
        return newSettings;
      });
      setSelectedPreset(preset);
      success(`Applied ${PRESETS[preset].name} preset`);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await apiClient.put('/professor/settings', settings);
      if (response.success) {
        success('Settings saved successfully');
      } else {
        throw new Error(response.message || 'Failed to save settings');
      }
    } catch (error: any) {
      console.error('Error saving settings:', error);
      showError(error.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout
      userName={user ? `${user.firstName} ${user.lastName}` : "Professor"}
      userType="professor"
    >
      <div className="max-w-7xl mx-auto h-auto lg:h-[calc(100vh-8rem)] flex flex-col pb-20 lg:pb-0">
        {/* Header */}
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/professor-attendance')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security Settings</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Configure attendance policies and security.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200 dark:shadow-none"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-6 lg:gap-8 min-h-0">
          {/* Sidebar Navigation */}
          <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-2">
            <div className="flex lg:flex-col overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 gap-2 no-scrollbar">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${activeSection === section.id
                    ? 'bg-white dark:bg-cardDark text-purple-600 dark:text-purple-400 shadow-sm border border-gray-100 dark:border-gray-700'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                >
                  <section.icon className={`w-5 h-5 ${activeSection === section.id ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`} />
                  {section.label}
                </button>
              ))}
            </div>

            <div className="mt-4 lg:mt-8 px-0 lg:px-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 hidden lg:block">Quick Presets</p>
              <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 no-scrollbar">
                {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((key) => {
                  const preset = PRESETS[key];
                  return (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      className={`w-64 lg:w-full text-left p-3 rounded-xl border transition-all flex-shrink-0 ${selectedPreset === key
                        ? `bg-${preset.color}-50 dark:bg-${preset.color}-900/20 border-${preset.color}-200 dark:border-${preset.color}-800`
                        : 'bg-white dark:bg-cardDark border-gray-100 dark:border-gray-700 hover:border-gray-300'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <preset.icon className={`w-4 h-4 text-${preset.color}-600 dark:text-${preset.color}-400`} />
                        <span className={`text-sm font-medium text-${preset.color}-900 dark:text-${preset.color}-100`}>{preset.name}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{preset.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 bg-white dark:bg-cardDark rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col min-h-[500px]">
            <div className="flex-1 overflow-y-auto p-4 lg:p-8">
              <AnimatePresence mode="wait">
                {activeSection === 'security' && (
                  <motion.div
                    key="security"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">General Security</h2>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Configure base security parameters for all sessions.</p>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Grace Period</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Time allowed after session start before marked late</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="30"
                            value={settings.security.defaultGracePeriod}
                            onChange={(e) => handleSettingChange('security', 'defaultGracePeriod', parseInt(e.target.value))}
                            className="w-32 accent-purple-600"
                          />
                          <span className="w-16 text-center font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                            {settings.security.defaultGracePeriod}m
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Risk Threshold</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Minimum confidence score to accept attendance</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={settings.security.defaultRiskThreshold}
                            onChange={(e) => handleSettingChange('security', 'defaultRiskThreshold', parseInt(e.target.value))}
                            className="w-32 accent-purple-600"
                          />
                          <span className="w-16 text-center font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                            {settings.security.defaultRiskThreshold}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeSection === 'location' && (
                  <motion.div
                    key="location"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Location & Geofencing</h2>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Manage location-based restrictions.</p>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Enable Geofencing</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Restrict attendance to specific coordinates</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.location.enableGeofencing}
                            onChange={(e) => handleSettingChange('location', 'enableGeofencing', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                        </label>
                      </div>

                      <div className={`transition-opacity ${!settings.location.enableGeofencing ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">Default Radius</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Allowed distance from session location</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <input
                              type="range"
                              min="10"
                              max="500"
                              step="10"
                              value={settings.location.defaultRadius}
                              onChange={(e) => handleSettingChange('location', 'defaultRadius', parseInt(e.target.value))}
                              className="w-32 accent-purple-600"
                            />
                            <span className="w-16 text-center font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                              {settings.location.defaultRadius}m
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Add other sections similarly... */}
                {activeSection === 'device' && (
                  <motion.div
                    key="device"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Device Restrictions</h2>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Prevent fraud using device fingerprinting.</p>
                    </div>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Device Fingerprinting</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Identify unique devices to prevent sharing</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.device.enableDeviceFingerprinting}
                            onChange={(e) => handleSettingChange('device', 'enableDeviceFingerprinting', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeSection === 'photo' && (
                  <motion.div
                    key="photo"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Photo Verification</h2>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Configure photo requirements for attendance.</p>
                    </div>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Require Photo</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Students must take a selfie to mark attendance</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.photo.requirePhotoVerification}
                            onChange={(e) => handleSettingChange('photo', 'requirePhotoVerification', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                      <div className={`transition-opacity ${!settings.photo.requirePhotoVerification ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex items-center justify-between mt-4">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">Face Detection</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Verify that a face is present in the photo</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.photo.enableFaceDetection}
                              onChange={(e) => handleSettingChange('photo', 'enableFaceDetection', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeSection === 'notifications' && (
                  <motion.div
                    key="notifications"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Notifications</h2>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Manage alert preferences.</p>
                    </div>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Email Notifications</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Receive summaries via email</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.notifications.enableEmailNotifications}
                            onChange={(e) => handleSettingChange('notifications', 'enableEmailNotifications', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Push Notifications</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Real-time alerts on your device</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.notifications.enablePushNotifications}
                            onChange={(e) => handleSettingChange('notifications', 'enablePushNotifications', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Fraud Alerts</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when suspicious activity is detected</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.notifications.notifyOnFraudDetection}
                            onChange={(e) => handleSettingChange('notifications', 'notifyOnFraudDetection', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
