import express from 'express';
import { QuizController } from '../controllers/quiz.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply authentication to all quiz routes
router.use(AuthMiddleware.authenticate());

// Professor routes
router.post('/', AuthMiddleware.requireRole(['professor', 'admin']), QuizController.createQuiz);
router.delete('/:id', AuthMiddleware.requireRole(['professor', 'admin']), QuizController.deleteQuiz);
router.get('/:id/results', AuthMiddleware.requireRole(['professor', 'admin']), QuizController.getQuizResults);


// Public/Student routes (but authenticated)
router.get('/course/:courseId', QuizController.getQuizzesByCourse);
router.get('/:id', QuizController.getQuizById);
router.post('/:id/submit', QuizController.submitQuiz);

export default router;
