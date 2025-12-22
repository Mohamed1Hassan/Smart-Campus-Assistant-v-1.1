import { apiClient, ApiResponse } from './api';

export interface Quiz {
    id: number;
    title: string;
    description?: string;
    courseId: number;
    timeLimit?: number;
    dueAt?: string;
    createdAt: string;
    updatedAt: string;
    questions?: Question[];
    _count?: {
        questions: number;
        submissions: number;
    };
}

export interface Question {
    id: number;
    text: string;
    type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'TEXT';
    points: number;
    order: number;
    options?: Option[];
}

export interface Option {
    id: number;
    text: string;
    isCorrect?: boolean; // Only visible to professor typically, but included here for creation
}

export interface CreateQuizData {
    title: string;
    description?: string;
    courseId: number;
    timeLimit?: number;
    dueAt?: string;
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

export interface SubmissionData {
    quizId: number;
    answers: {
        questionId: number;
        selectedOptionId?: number;
        textAnswer?: string;
    }[];
}

export const QuizService = {
    createQuiz: async (data: CreateQuizData): Promise<ApiResponse<Quiz>> => {
        return apiClient.post('/quizzes', data);
    },

    getQuizzesByCourse: async (courseId: number): Promise<ApiResponse<Quiz[]>> => {
        return apiClient.get(`/quizzes/course/${courseId}`);
    },

    getQuizById: async (id: number): Promise<ApiResponse<Quiz>> => {
        return apiClient.get(`/quizzes/${id}`);
    },

    submitQuiz: async (id: number, data: SubmissionData): Promise<ApiResponse<any>> => {
        return apiClient.post(`/quizzes/${id}/submit`, data);
    },

    deleteQuiz: async (id: number): Promise<ApiResponse<void>> => {
        return apiClient.delete(`/quizzes/${id}`);
    },

    getQuizResults: async (id: number): Promise<ApiResponse<QuizSubmission[]>> => {
        return apiClient.get(`/quizzes/${id}/results`);
    }
};

export interface QuizSubmission {
    id: number;
    quizId: number;
    studentId: number;
    score: number;
    submittedAt: string;
    student: {
        id: number;
        name: string;
        universityId: string;
        email: string;
    };
}
