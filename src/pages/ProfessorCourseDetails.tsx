import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/common/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { MaterialsList } from '../components/common/MaterialsList';
import MaterialUploadModal from '../components/professor/MaterialUploadModal';
import {
    BookOpen, Users, Calendar, FileText,
    ArrowLeft, Plus, Clock, GraduationCap, Search, Mail
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { QuizDashboard } from '../components/quiz/QuizDashboard';

interface Student {
    id: number;
    firstName: string;
    lastName: string;
    universityId: string;
    email: string;
}

interface Enrollment {
    student: Student;
}

interface CourseDetails {
    id: number;
    courseCode: string;
    courseName: string;
    description: string;
    credits: number;
    professorId: number;
    schedules: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        room: string;
    }>;
    enrollments: Enrollment[];
    _count?: {
        enrollments: number;
    };
}

export default function ProfessorCourseDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [course, setCourse] = useState<CourseDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [refreshMaterials, setRefreshMaterials] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchCourseDetails = async () => {
            if (!id) return;

            try {
                setLoading(true);
                const response = await apiClient.get(`/api/courses/${id}`);
                if (response.success) {
                    setCourse(response.data);
                } else {
                    toast.error('Failed to load course details');
                    navigate('/professor-courses');
                }
            } catch (error) {
                console.error('Error fetching course:', error);
                toast.error('Failed to load course details');
                navigate('/professor-courses');
            } finally {
                setLoading(false);
            }
        };

        fetchCourseDetails();
    }, [id, navigate]);

    const handleMaterialSuccess = () => {
        // Trigger a re-fetch of materials by incrementing the key
        setRefreshMaterials(prev => prev + 1);
    };

    if (loading) {
        return (
            <DashboardLayout userName={user?.firstName} userType="professor">
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </DashboardLayout>
        );
    }

    if (!course) return null;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const filteredStudents = course.enrollments?.filter(enrollment =>
        enrollment.student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        enrollment.student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        enrollment.student.universityId.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    return (
        <DashboardLayout userName={user?.firstName} userType="professor">
            <div className="max-w-7xl mx-auto space-y-8 pb-12">
                {/* Header */}
                <div className="space-y-4">
                    <Button
                        variant="ghost"
                        className="pl-0 hover:bg-transparent hover:text-blue-600"
                        onClick={() => navigate('/professor-courses')}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Courses
                    </Button>

                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <BookOpen className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs font-bold">
                                        {course.courseCode}
                                    </span>
                                    <span className="text-gray-500 dark:text-gray-400 text-sm">
                                        {course.credits} Credits
                                    </span>
                                </div>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {course.courseName}
                                </h1>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="w-full justify-start border-b border-gray-200 dark:border-gray-700 bg-transparent p-0 mb-8 rounded-none">
                        <TabsTrigger
                            value="overview"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none px-6 py-3"
                        >
                            Overview
                        </TabsTrigger>
                        <TabsTrigger
                            value="students"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none px-6 py-3"
                        >
                            Students
                        </TabsTrigger>
                        <TabsTrigger
                            value="resources"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none px-6 py-3"
                        >
                            Resources & Materials
                        </TabsTrigger>
                        <TabsTrigger
                            value="quizzes"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none px-6 py-3"
                        >
                            Quizzes
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-cardDark p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-blue-500" />
                                    Schedule
                                </h3>
                                <div className="space-y-3">
                                    {course.schedules && course.schedules.length > 0 ? (
                                        course.schedules.map((schedule, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                                <span className="font-medium">{dayNames[schedule.dayOfWeek]}</span>
                                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                                    {schedule.startTime} - {schedule.endTime}
                                                    <span className="mx-2">•</span>
                                                    {schedule.room || 'TBA'}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500">No schedule set</p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-cardDark p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-green-500" />
                                    Description
                                </h3>
                                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                                    {course.description || 'No description available.'}
                                </p>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="students">
                        <div className="bg-white dark:bg-cardDark p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <Users className="w-5 h-5 text-blue-600" />
                                        Student List
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Total Enrolled: {course.enrollments?.length || 0}
                                    </p>
                                </div>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search students..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            {filteredStudents.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-100 dark:border-gray-700">
                                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Name</th>
                                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">ID</th>
                                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Email</th>
                                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredStudents.map((enrollment) => (
                                                <tr key={enrollment.student.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                                                                {enrollment.student.firstName[0]}{enrollment.student.lastName[0]}
                                                            </div>
                                                            <span className="font-medium text-gray-900 dark:text-white">
                                                                {enrollment.student.firstName} {enrollment.student.lastName}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                                                        {enrollment.student.universityId}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                                                        {enrollment.student.email}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                            <Mail className="w-4 h-4 text-gray-400 hover:text-blue-600" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                                    <p className="text-gray-500">No students found.</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="resources" className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Course Materials</h3>
                                <p className="text-gray-500 text-sm">Upload lecture notes, assignments, and other resources.</p>
                            </div>
                            <Button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                Add Material
                            </Button>
                        </div>

                        <MaterialsList
                            key={refreshMaterials}
                            courseId={course.id}
                            userRole="PROFESSOR"
                        />
                    </TabsContent>

                    <TabsContent value="quizzes" className="space-y-6">
                        <QuizDashboard courseId={course.id} userRole="PROFESSOR" />
                    </TabsContent>
                </Tabs>
            </div>

            <MaterialUploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                courseId={course.id}
                onSuccess={handleMaterialSuccess}
            />
        </DashboardLayout>
    );
}
