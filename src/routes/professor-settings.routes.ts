import { Router } from 'express';
import { ProfessorSettingsController } from '../controllers/professor-settings.controller.js';
import AuthMiddleware from '../middleware/auth.middleware.js';

const router = Router();

// Protect all routes
router.use(AuthMiddleware.authenticate());
router.use(AuthMiddleware.requireRole('professor'));

// Get settings
router.get('/', ProfessorSettingsController.getSettings);

// Update settings
router.put('/', ProfessorSettingsController.updateSettings);

export default router;
