import { PrismaClient } from '@prisma/client';
import prisma from '../../config/database.js';

export interface CreateQuizData {
    title: string;
    description?: string;
    courseId: number;
    timeLimit?: number;
    dueAt?: Date;
    professorId: number;
    questions: {
        text: string;
        type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'TEXT';
        points: number;
        order: number;
        options: {
            text: string;
            isCorrect: boolean;
        }[];
    }[];
}

export interface SubmitQuizData {
    quizId: number;
    studentId: number;
    answers: {
        questionId: number;
        selectedOptionId?: number;
        textAnswer?: string;
    }[];
}

export class QuizServerService {

    /**
     * Create a new quiz with questions and options
     */
    static async createQuiz(data: CreateQuizData) {
        // Use a transaction to ensure everything is created or nothing is
        return await prisma.$transaction(async (tx) => {
            // 1. Create the quiz
            const quiz = await tx.quiz.create({
                data: {
                    title: data.title,
                    description: data.description,
                    courseId: data.courseId,
                    timeLimit: data.timeLimit,
                    dueAt: data.dueAt,
                    isActive: true // Activate by default for now
                }
            });

            // 2. Create questions and options
            for (const q of data.questions) {
                const question = await tx.question.create({
                    data: {
                        quizId: quiz.id,
                        text: q.text,
                        type: q.type,
                        points: q.points,
                        order: q.order
                    }
                });

                // Create options for this question
                if (q.options && q.options.length > 0) {
                    await tx.option.createMany({
                        data: q.options.map(opt => ({
                            questionId: question.id,
                            text: opt.text,
                            isCorrect: opt.isCorrect
                        }))
                    });
                }
            }

            return quiz;
        });
    }

    /**
     * Get all quizzes for a course
     */
    static async getQuizzesByCourse(courseId: number) {
        return await prisma.quiz.findMany({
            where: { courseId },
            include: {
                _count: {
                    select: {
                        questions: true,
                        submissions: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Get a single quiz by ID with questions
     * For students, we might want to hide correct answers, but for now sending all
     * ideally we should filter isCorrect for students
     */
    static async getQuizById(id: number) {
        return await prisma.quiz.findUnique({
            where: { id },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                    include: {
                        options: true
                    }
                }
            }
        });
    }

    /**
     * Delete a quiz
     */
    static async deleteQuiz(id: number) {
        return await prisma.quiz.delete({
            where: { id }
        });
    }

    /**
     * Submit a quiz
     */
    static async submitQuiz(data: SubmitQuizData) {
        const { quizId, studentId, answers } = data;

        // 1. Fetch the quiz questions and correct options to calculate score
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: {
                questions: {
                    include: { options: true }
                }
            }
        });

        if (!quiz) throw new Error('Quiz not found');

        let totalScore = 0;
        let maxScore = 0;

        // 2. Calculate score
        const processedAnswers = answers.map(answer => {
            const question = quiz.questions.find(q => q.id === answer.questionId);
            if (!question) return null;

            let isCorrect = false;

            if (question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE') {
                const selectedOption = question.options.find(o => o.id === answer.selectedOptionId);
                if (selectedOption && selectedOption.isCorrect) {
                    isCorrect = true;
                }
            } else {
                // For text answers, we might need manual grading or simple matching
                // For now, auto-mark correct if not empty (PLACEHOLDER)
                if (answer.textAnswer && answer.textAnswer.trim().length > 0) {
                    // Manual grading needed usually, skipping auto-points for text
                }
            }

            if (isCorrect) totalScore += question.points;
            maxScore += question.points;

            return {
                questionId: answer.questionId,
                selectedOptionId: answer.selectedOptionId,
                textAnswer: answer.textAnswer,
                isCorrect
            };
        }).filter(Boolean);

        // 3. Create submission record
        return await prisma.quizSubmission.create({
            data: {
                quizId,
                studentId,
                score: totalScore,
                answers: {
                    create: processedAnswers as any
                }
            }
        });
    }

    /**
     * Get results/submissions for a specific quiz (For Professor)
     */
    static async getQuizResults(quizId: number) {
        return await prisma.quizSubmission.findMany({
            where: { quizId },
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        universityId: true,
                        email: true
                    }
                }
            },
            orderBy: { score: 'desc' }
        });
    }
}
