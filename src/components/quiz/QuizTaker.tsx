import React, { useState, useEffect } from 'react';
import { Quiz, Question, QuizService, SubmissionData } from '../../services/quiz.service';
import { Timer, AlertTriangle, CheckCircle } from 'lucide-react';

interface QuizTakerProps {
    quiz: Quiz;
    onComplete: (score: number) => void;
    onCancel: () => void;
}

export const QuizTaker: React.FC<QuizTakerProps> = ({ quiz, onComplete, onCancel }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, number>>({}); // questionId -> optionId
    const [timeLeft, setTimeLeft] = useState<number>((quiz.timeLimit || 30) * 60);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit(); // Auto-submit when time runs out
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleOptionSelect = (questionId: number, optionId: number) => {
        setAnswers({
            ...answers,
            [questionId]: optionId
        });
    };

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);

        const submissionData: SubmissionData = {
            quizId: quiz.id,
            answers: Object.entries(answers).map(([qId, oId]) => ({
                questionId: parseInt(qId),
                selectedOptionId: oId
            }))
        };

        try {
            const response = await QuizService.submitQuiz(quiz.id, submissionData);
            if (response.success) {
                onComplete(response.data.score);
            }
        } catch (error) {
            console.error('Submission failed:', error);
        } finally {
            setSubmitting(false);
        }
    };

    if (!quiz.questions || quiz.questions.length === 0) {
        return <div>This quiz has no questions.</div>;
    }

    const currentQuestion = quiz.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;
    const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;

    return (
        <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
                <div>
                    <h2 className="text-xl font-bold">{quiz.title}</h2>
                    <p className="text-blue-100 text-sm">Question {currentQuestionIndex + 1} of {quiz.questions.length}</p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${timeLeft < 60 ? 'bg-red-500' : 'bg-blue-500/50'}`}>
                    <Timer size={18} />
                    <span className="font-mono font-medium">{formatTime(timeLeft)}</span>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-gray-200 dark:bg-gray-700 w-full">
                <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Question Area */}
            <div className="p-8">
                <div className="mb-8">
                    <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded mb-3">
                        {currentQuestion.points} Points
                    </span>
                    <h3 className="text-xl font-medium text-gray-900 dark:text-white leading-relaxed">
                        {currentQuestion.text}
                    </h3>
                </div>

                <div className="space-y-3">
                    {currentQuestion.options?.map((option) => (
                        <label
                            key={option.id}
                            className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${answers[currentQuestion.id] === option.id
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                                }`}
                        >
                            <input
                                type="radio"
                                name={`question-${currentQuestion.id}`}
                                value={option.id}
                                checked={answers[currentQuestion.id] === option.id}
                                onChange={() => handleOptionSelect(currentQuestion.id, option.id)}
                                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <span className="ml-3 text-gray-700 dark:text-gray-200">{option.text}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Navigation */}
            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex justify-between items-center border-t border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestionIndex === 0}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 disabled:opacity-50 hover:text-gray-900 dark:hover:text-white"
                >
                    Previous
                </button>

                {isLastQuestion ? (
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-70"
                    >
                        {submitting ? 'Submitting...' : 'Submit Quiz'}
                        {!submitting && <CheckCircle size={18} className="ml-2" />}
                    </button>
                ) : (
                    <button
                        onClick={() => setCurrentQuestionIndex(prev => Math.min(quiz.questions!.length - 1, prev + 1))}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        Next Question
                    </button>
                )}
            </div>
        </div>
    );
};
