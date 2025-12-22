import React, { useState } from 'react';
import { CreateQuizData } from '../../services/quiz.service';
import { Plus, Trash2, Save, X } from 'lucide-react';

interface QuizCreatorProps {
    courseId: number;
    onSave: (data: CreateQuizData) => Promise<void>;
    onCancel: () => void;
}

export const QuizCreator: React.FC<QuizCreatorProps> = ({ courseId, onSave, onCancel }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [timeLimit, setTimeLimit] = useState<number>(30);
    const [questions, setQuestions] = useState<CreateQuizData['questions']>([]);
    const [loading, setLoading] = useState(false);

    const addQuestion = (type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'TEXT' = 'MULTIPLE_CHOICE') => {
        setQuestions([
            ...questions,
            {
                text: '',
                type,
                points: 1,
                order: questions.length,
                options: type === 'TRUE_FALSE'
                    ? [
                        { text: 'True', isCorrect: true },
                        { text: 'False', isCorrect: false }
                    ]
                    : [
                        { text: '', isCorrect: false },
                        { text: '', isCorrect: false }
                    ]
            }
        ]);
    };

    const updateQuestion = (index: number, field: string, value: any) => {
        const newQuestions = [...questions];
        (newQuestions[index] as any)[field] = value;
        setQuestions(newQuestions);
    };

    const updateOption = (qIndex: number, oIndex: number, field: string, value: any) => {
        const newQuestions = [...questions];
        (newQuestions[qIndex].options[oIndex] as any)[field] = value;

        // For radio behavior (only one correct answer)
        if (field === 'isCorrect' && value === true) {
            newQuestions[qIndex].options.forEach((opt, idx) => {
                if (idx !== oIndex) opt.isCorrect = false;
            });
        }

        setQuestions(newQuestions);
    };

    const addOption = (qIndex: number) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options.push({ text: '', isCorrect: false });
        setQuestions(newQuestions);
    };

    const removeOption = (qIndex: number, oIndex: number) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options.splice(oIndex, 1);
        setQuestions(newQuestions);
    };

    const removeQuestion = (index: number) => {
        const newQuestions = [...questions];
        newQuestions.splice(index, 1);
        setQuestions(newQuestions);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) return;

        setLoading(true);
        try {
            await onSave({
                title,
                description,
                courseId,
                timeLimit,
                questions
            });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Quiz</h2>
                <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
                    <X size={24} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quiz Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="e.g., Midterm Exam"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Time Limit (Minutes)</label>
                        <input
                            type="number"
                            value={timeLimit}
                            onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            min="1"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        rows={3}
                    />
                </div>

                <div className="border-t pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Questions</h3>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => addQuestion('MULTIPLE_CHOICE')}
                                className="flex items-center px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
                            >
                                <Plus size={16} className="mr-1" />
                                Add Multiple Choice
                            </button>
                            <button
                                type="button"
                                onClick={() => addQuestion('TRUE_FALSE')}
                                className="flex items-center px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded-md hover:bg-green-100"
                            >
                                <Plus size={16} className="mr-1" />
                                Add True/False
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {questions.map((q, qIndex) => (
                            <div key={qIndex} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1 mr-4">
                                        <input
                                            type="text"
                                            value={q.text}
                                            onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                                            placeholder="Question text..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            required
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={q.points}
                                            onChange={(e) => updateQuestion(qIndex, 'points', parseInt(e.target.value))}
                                            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 dark:text-white dark:bg-gray-600"
                                            min="1"
                                        />
                                        <span className="text-sm text-gray-500 dark:text-gray-400">pts</span>
                                        <button
                                            type="button"
                                            onClick={() => removeQuestion(qIndex)}
                                            className="text-red-500 hover:text-red-700 ml-2"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                                    {q.options.map((opt, oIndex) => (
                                        <div key={oIndex} className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name={`q${qIndex}-correct`}
                                                checked={opt.isCorrect}
                                                onChange={(e) => updateOption(qIndex, oIndex, 'isCorrect', e.target.checked)}
                                                className="h-4 w-4 text-blue-600"
                                            />
                                            <input
                                                type="text"
                                                value={opt.text}
                                                onChange={(e) => updateOption(qIndex, oIndex, 'text', e.target.value)}
                                                placeholder={`Option ${oIndex + 1}`}
                                                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                required
                                            />
                                            {q.type !== 'TRUE_FALSE' && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeOption(qIndex, oIndex)}
                                                    className="text-gray-400 hover:text-red-500"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}

                                    {q.type !== 'TRUE_FALSE' && (
                                        <button
                                            type="button"
                                            onClick={() => addOption(qIndex)}
                                            className="text-sm text-blue-500 hover:text-blue-700 mt-2 flex items-center"
                                        >
                                            <Plus size={14} className="mr-1" /> Add Option
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {questions.length === 0 && (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                                Click one of the buttons above to add your first question
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t font-medium">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || questions.length === 0}
                        className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={18} className="mr-2" />
                        {loading ? 'Saving...' : 'Save Quiz'}
                    </button>
                </div>
            </form>
        </div>
    );
};
