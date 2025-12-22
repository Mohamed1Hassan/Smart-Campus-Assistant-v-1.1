import React, { useEffect, useState } from 'react';
import { Quiz, QuizService, CreateQuizData } from '../../services/quiz.service';
import { QuizCreator } from './QuizCreator';
import { QuizTaker } from './QuizTaker';
import { QuizResults } from './QuizResults';
import { Plus, Clock, FileText, ChevronRight, Trophy, Trash2, PieChart } from 'lucide-react';

interface QuizDashboardProps {
    courseId: number;
    userRole: 'PROFESSOR' | 'STUDENT' | 'ADMIN';
}

export const QuizDashboard: React.FC<QuizDashboardProps> = ({ courseId, userRole }) => {
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'LIST' | 'CREATE' | 'TAKE' | 'RESULT' | 'SHOW_RESULTS'>('LIST');
    const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
    const [lastScore, setLastScore] = useState<number | null>(null);

    useEffect(() => {
        loadQuizzes();
    }, [courseId]);

    const loadQuizzes = async () => {
        setLoading(true);
        try {
            const response = await QuizService.getQuizzesByCourse(courseId);
            if (response.success && response.data) {
                setQuizzes(response.data);
            }
        } catch (error) {
            console.error('Failed to load quizzes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateQuiz = async (data: CreateQuizData) => {
        try {
            const response = await QuizService.createQuiz(data);
            if (response.success) {
                await loadQuizzes();
                setView('LIST');
            }
        } catch (error) {
            console.error('Failed to create quiz:', error);
        }
    };

    const handleDeleteQuiz = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this quiz?')) return;

        try {
            await QuizService.deleteQuiz(id);
            setQuizzes(quizzes.filter(q => q.id !== id));
        } catch (error) {
            console.error('Failed to delete quiz:', error);
        }
    };

    const startQuiz = async (quiz: Quiz) => {
        // Ideally fetch full quiz details here to get questions
        const response = await QuizService.getQuizById(quiz.id);
        if (response.success && response.data) {
            setSelectedQuiz(response.data);
            setView('TAKE');
        }
    };

    const handleQuizComplete = (score: number) => {
        setLastScore(score);
        setView('RESULT');
    };

    if (view === 'CREATE') {
        return (
            <QuizCreator
                courseId={courseId}
                onSave={handleCreateQuiz}
                onCancel={() => setView('LIST')}
            />
        );
    }

    if (view === 'TAKE' && selectedQuiz) {
        return (
            <QuizTaker
                quiz={selectedQuiz}
                onComplete={handleQuizComplete}
                onCancel={() => setView('LIST')}
            />
        );
    }

    if (view === 'RESULT') {
        return (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
                    <Trophy size={40} className="text-yellow-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Quiz Completed!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8">You have successfully submitted your answers.</p>

                <div className="text-5xl font-bold text-blue-600 mb-8">
                    {lastScore} <span className="text-xl text-gray-400 font-normal">points</span>
                </div>

                <button
                    onClick={() => setView('LIST')}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Back to Quizzes
                </button>
            </div>
        );
    }

    if (view === 'SHOW_RESULTS' && selectedQuiz) {
        return (
            <QuizResults
                quizId={selectedQuiz.id}
                quizTitle={selectedQuiz.title}
                onBack={() => setView('LIST')}
            />
        );
    }

    const handleViewResults = (quiz: Quiz) => {
        setSelectedQuiz(quiz);
        setView('SHOW_RESULTS');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quizzes</h2>
                {userRole !== 'STUDENT' && (
                    <button
                        onClick={() => setView('CREATE')}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={20} className="mr-2" />
                        Create Quiz
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : quizzes.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No quizzes yet</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        {userRole === 'STUDENT'
                            ? 'There are no quizzes available for this course yet.'
                            : 'Create your first quiz to get started.'}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {quizzes.map((quiz) => (
                        <div
                            key={quiz.id}
                            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow flex justify-between items-center group"
                        >
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{quiz.title}</h3>
                                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                    <div className="flex items-center">
                                        <Clock size={14} className="mr-1" />
                                        {quiz.timeLimit ? `${quiz.timeLimit} mins` : 'No limit'}
                                    </div>
                                    {quiz._count && (
                                        <div>{quiz._count.questions} questions</div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {userRole === 'STUDENT' ? (
                                    <button
                                        onClick={() => startQuiz(quiz)}
                                        className="flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all"
                                    >
                                        Start Quiz
                                        <ChevronRight size={16} className="ml-2" />
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDeleteQuiz(quiz.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Quiz"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleViewResults(quiz)}
                                            className="flex items-center px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                                        >
                                            <PieChart size={18} className="mr-2" />
                                            View Results
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
