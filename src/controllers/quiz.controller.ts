import { Request, Response } from 'express';
import { QuizServerService } from '../services/quiz.server.service.js';

export class QuizController {

    /**
     * Create a new quiz
     * POST /api/quizzes
     */
    static async createQuiz(req: any, res: Response): Promise<void> {
        try {
            const { title, description, courseId, timeLimit, dueAt, questions } = req.body;
            const professorId = req.user?.id;

            if (!professorId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }

            // Basic validation
            if (!title || !courseId) {
                res.status(400).json({ success: false, message: 'Title and Course ID are required' });
                return;
            }

            const quiz = await QuizServerService.createQuiz({
                title,
                description,
                courseId: Number(courseId),
                timeLimit: timeLimit ? Number(timeLimit) : undefined,
                dueAt: dueAt ? new Date(dueAt) : undefined,
                questions,
                professorId
            });

            res.status(201).json({
                success: true,
                message: 'Quiz created successfully',
                data: quiz
            });
        } catch (error: any) {
            console.error('Error creating quiz:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Get quizzes by course
     * GET /api/quizzes/course/:courseId
     */
    static async getQuizzesByCourse(req: Request, res: Response): Promise<void> {
        try {
            const courseId = parseInt(req.params.courseId);
            if (isNaN(courseId)) {
                res.status(400).json({ success: false, message: 'Invalid course ID' });
                return;
            }

            const quizzes = await QuizServerService.getQuizzesByCourse(courseId);
            res.status(200).json({ success: true, data: quizzes });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Get quiz by ID
     * GET /api/quizzes/:id
     */
    static async getQuizById(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                res.status(400).json({ success: false, message: 'Invalid quiz ID' });
                return;
            }

            const quiz = await QuizServerService.getQuizById(id);
            if (!quiz) {
                res.status(404).json({ success: false, message: 'Quiz not found' });
                return;
            }

            res.status(200).json({ success: true, data: quiz });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Submit quiz
     * POST /api/quizzes/:id/submit
     */
    static async submitQuiz(req: any, res: Response): Promise<void> {
        try {
            const quizId = parseInt(req.params.id);
            const studentId = req.user?.id;
            const { answers } = req.body;

            if (!studentId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }

            if (!answers || !Array.isArray(answers)) {
                res.status(400).json({ success: false, message: 'Invalid answers format' });
                return;
            }

            const submission = await QuizServerService.submitQuiz({
                quizId,
                studentId: Number(studentId),
                answers
            });

            res.status(200).json({
                success: true,
                message: 'Quiz submitted successfully',
                data: submission
            });
        } catch (error: any) {
            console.error('Error submitting quiz:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Delete quiz
     * DELETE /api/quizzes/:id
     */
    static async deleteQuiz(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id);
            await QuizServerService.deleteQuiz(id);
            res.status(200).json({ success: true, message: 'Quiz deleted successfully' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Get quiz results (Professor only)
     * GET /api/quizzes/:id/results
     */
    static async getQuizResults(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                res.status(400).json({ success: false, message: 'Invalid quiz ID' });
                return;
            }

            const results = await QuizServerService.getQuizResults(id);
            res.status(200).json({ success: true, data: results });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
