// Chatbot Type Definitions
export interface ChatMessage {
  id?: number;
  sessionId: number;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  language: string;
  metadata?: Record<string, any>;
  isProcessed: boolean;
  responseTime?: number;
  createdAt?: Date;
}

export interface ChatSession {
  id?: number;
  userId: number;
  sessionName?: string;
  isActive: boolean;
  language: string;
  context?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
  lastMessageAt?: Date;
  messages?: ChatMessage[];
}

export interface AIResponse {
  content: string;
  language: string;
  confidence: number;
  suggestions?: string[];
  metadata?: Record<string, any>;
  responseTime: number;
}

export interface ChatRequest {
  message: string;
  sessionId?: number;
  language?: string;
  context?: Record<string, any>;
}

export interface ChatResponse {
  message: ChatMessage;
  session: ChatSession;
  suggestions?: string[];
  analytics?: ChatAnalytics;
}

export interface ChatAnalytics {
  totalMessages: number;
  averageResponseTime: number;
  popularQuestions: Array<{
    question: string;
    count: number;
    language: string;
  }>;
  userSatisfaction?: number;
  languageDistribution: Record<string, number>;
}

export interface KnowledgeBaseItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  language: string;
  tags: string[];
  confidence: number;
  lastUpdated: Date;
}

export interface CourseContext {
  courseId: number;
  courseCode: string;
  courseName: string;
  professorName: string;
  schedule: any[];
  assignments: any[];
  announcements: any[];
}

export interface ChatbotConfig {
  maxContextLength: number;
  responseTimeout: number;
  enableAnalytics: boolean;
  enableSuggestions: boolean;
  supportedLanguages: string[];
  defaultLanguage: string;
}

export interface ChatSuggestion {
  id: string;
  text: string;
  category: string;
  language: string;
  popularity: number;
}

export interface ChatHistory {
  session: ChatSession;
  messages: ChatMessage[];
  totalCount: number;
  hasMore: boolean;
}

export interface ChatStats {
  totalSessions: number;
  totalMessages: number;
  averageSessionLength: number;
  mostActiveUsers: Array<{
    userId: number;
    userName: string;
    messageCount: number;
  }>;
  popularQuestions: Array<{
    question: string;
    count: number;
    language: string;
  }>;
  responseTimeStats: {
    average: number;
    median: number;
    p95: number;
  };
}

export interface LanguageDetection {
  detectedLanguage: string;
  confidence: number;
  alternatives: Array<{
    language: string;
    confidence: number;
  }>;
}

export interface ContextEnhancement {
  userProfile?: {
    role: string;
    courses: string[];
    preferences: Record<string, any>;
  };
  userCourses?: CourseContext[];
  courseContext?: CourseContext;
  timeContext?: {
    currentTime: Date;
    semester: string;
    academicYear: string;
  };
  systemContext?: {
    announcements?: any[];
    upcomingEvents?: any[];
    systemStatus?: string;
    sessionContext?: any;
    [key: string]: any;
  };
  grades?: Array<{
    courseName: string;
    courseCode: string;
    score: number;
    quizTitle: string;
    submittedAt: Date;
  }>;
  attendanceSummary?: Array<{
    courseName: string;
    courseCode: string;
    present: number;
    absent: number;
    late: number;
    attendancePercentage: number;
  }>;
}

export class ChatbotError extends Error {
  code: string;
  details?: Record<string, any>;
  timestamp: Date;

  constructor(data: { code: string; message: string; details?: Record<string, any>; timestamp: Date }) {
    super(data.message);
    this.code = data.code;
    this.details = data.details;
    this.timestamp = data.timestamp;
    this.name = 'ChatbotError';
  }
}

export interface ChatbotMetrics {
  requestsPerMinute: number;
  averageResponseTime: number;
  errorRate: number;
  activeSessions: number;
  totalUsers: number;
  languageDistribution: Record<string, number>;
  categoryDistribution: Record<string, number>;
}
