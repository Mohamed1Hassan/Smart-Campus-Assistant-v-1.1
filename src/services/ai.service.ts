import { AIResponse, LanguageDetection, ContextEnhancement, ChatbotError } from '../types/chatbot.types.js';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

export class AIService {
  private prisma: PrismaClient;
  private openai: OpenAI | undefined;
  private responseCache: Map<string, AIResponse> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  private getOpenAIClient(): OpenAI {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || 'your_openai_api_key_here',
        baseURL: process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1'
      });
    }
    // Check if we need to re-initialize because env vars might have loaded after first init
    // (This handles the case where it was initialized with default but env var is now available)
    if (this.openai.apiKey === 'your_openai_api_key_here' && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || '',
        baseURL: process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1'
      });
    }
    return this.openai;
  }

  /**
   * Generate AI response with context awareness
   */
  async generateResponse(
    message: string,
    context: ContextEnhancement,
    language: string = 'en'
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(message, context, language);
      const cachedResponse = this.responseCache.get(cacheKey);
      if (cachedResponse && this.isCacheValid(cacheKey)) {
        return cachedResponse;
      }

      // Detect language if not provided
      const detectedLanguage = await this.detectLanguage(message);
      const targetLanguage = language || detectedLanguage.detectedLanguage;

      // Enhance context with user and system information
      const enhancedContext = await this.enhanceContext(context, targetLanguage);

      // Generate response based on message type and context
      const response = await this.processMessage(message, enhancedContext, targetLanguage);

      // Calculate response time
      const responseTime = Date.now() - startTime;
      response.responseTime = responseTime;

      // Cache the response
      this.cacheResponse(cacheKey, response);

      return response;
    } catch (error: any) {
      console.error('Error generating AI response:', error);
      throw new ChatbotError({
        code: 'AI_RESPONSE_ERROR',
        message: 'Failed to generate AI response',
        details: { error: error.message },
        timestamp: new Date()
      });
    }
  }

  /**
   * Detect language of the input message
   */
  async detectLanguage(text: string): Promise<LanguageDetection> {
    // Simple language detection based on character patterns
    const arabicPattern = /[\u0600-\u06FF]/;
    const englishPattern = /[a-zA-Z]/;

    const arabicMatches = (text.match(arabicPattern) || []).length;
    const englishMatches = (text.match(englishPattern) || []).length;

    if (arabicMatches > englishMatches) {
      return {
        detectedLanguage: 'ar',
        confidence: Math.min(0.9, arabicMatches / text.length),
        alternatives: [
          { language: 'en', confidence: 1 - (arabicMatches / text.length) }
        ]
      };
    } else {
      return {
        detectedLanguage: 'en',
        confidence: Math.min(0.9, englishMatches / text.length),
        alternatives: [
          { language: 'ar', confidence: 1 - (englishMatches / text.length) }
        ]
      };
    }
  }

  /**
   * Enhance context with additional information
   */
  private async enhanceContext(
    context: ContextEnhancement,
    language: string
  ): Promise<ContextEnhancement> {
    const enhanced = { ...context };

    // Add time context
    enhanced.timeContext = {
      currentTime: new Date(),
      semester: this.getCurrentSemester(),
      academicYear: this.getCurrentAcademicYear()
    };

    // Add system context
    enhanced.systemContext = {
      announcements: await this.getRecentAnnouncements(),
      upcomingEvents: await this.getUpcomingEvents(),
      systemStatus: 'operational'
    };

    // Add User Specific Context if userId is available in context (need to ensure caller passes it)
    // For now assuming context.userProfile has it or we can find it. 
    // Actually, let's add userId to ContextEnhancement in types first or relies on caller?
    // The current ContextEnhancement doesn't have userId.
    // I will add userId to ContextEnhancement in types.ts in a separate step or just cast it here.
    const userId = (context as any).userId;

    if (userId) {
      enhanced.grades = await this.getUserGrades(userId);
      enhanced.attendanceSummary = await this.getUserAttendanceSummary(userId);

      // Also enhance userCourses with real schedule if not present
      if (!enhanced.userCourses) {
        enhanced.userCourses = await this.getUserCourses(userId);
      }
    }

    return enhanced;
  }

  /**
   * Process message and generate appropriate response using AI
   */
  private async processMessage(
    message: string,
    context: ContextEnhancement,
    language: string
  ): Promise<AIResponse> {
    try {
      // Build system prompt with university context
      const systemPrompt = this.buildSystemPrompt(language, context);

      // Build user context
      const userContext = this.buildUserContext(message, context, language);

      // Call OpenAI API with DeepSeek model
      const completion = await this.getOpenAIClient().chat.completions.create({
        model: process.env.OPENAI_MODEL || 'deepseek/deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContext }
        ],
        max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const aiResponse = completion.choices[0]?.message?.content || '';

      // Generate suggestions based on the response
      const suggestions = await this.generateSuggestions(message, language, context);

      return {
        content: aiResponse,
        language,
        confidence: 0.9,
        suggestions,
        metadata: {
          type: 'ai_generated',
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
          tokens: completion.usage?.total_tokens || 0
        },
        responseTime: 0
      };
    } catch (error) {
      console.error('Error calling OpenAI API:', error);

      // Fallback to rule-based responses if AI fails
      return this.generateFallbackResponse(message, context, language);
    }
  }

  /**
   * Build system prompt with university context
   */
  private buildSystemPrompt(language: string, context: ContextEnhancement): string {
    const basePrompts = {
      en: `You are an intelligent, friendly AI assistant for Smart Campus University.
      
Your goal is to help students and professors with their academic needs in a natural, conversational way.

CONTEXT:
- User Role: ${context.userProfile?.role || 'student'}
- Semester: ${context.timeContext?.semester || 'Current'}

GUIDELINES:
1. **Be Natural**: Speak like a helpful university staff member, not a robot.
2. **Be Context-Aware**: You know the user's courses and schedule. Use this info ONLY when relevant to their question.
3. **Be Concise**: For greetings ("hi", "how are you"), keep it short and friendly. Don't list features unless asked.
4. **Be Helpful**: For specific questions (schedule, grades), provide direct details and actionable steps.

DO NOT:
- Do not start every message with "As a professor..." or "Welcome to...".
- Do not list all your capabilities in every response.
- Do not use bullet points for simple conversational replies.`,

      ar: `أنت مساعد ذكي وودود لجامعة الحرم الذكي.

هدف هو مساعدة الطلاب والأساتذة في احتياجاتهم الأكاديمية بطريقة طبيعية ومحادثة.

السياق:
- دور المستخدم: ${context.userProfile?.role || 'طالب'}
- الفصل الدراسي: ${context.timeContext?.semester || 'الحالي'}

إرشادات:
1. **كن طبيعياً**: تحدث كموظف جامعي متعاون، وليس كروبوت.
2. **استخدم السياق بذكاء**: أنت تعرف مواد المستخدم وجدوله. استخدم هذه المعلومات فقط عندما تكون ذات صلة بسؤالهم.
3. **كن مختصراً**: في التحيات ("مرحبا"، "كيف حالك")، اجعل الرد قصيراً وودوداً. لا تسرد المميزات إلا إذا طُلب منك.
4. **كن مفيداً**: للأسئلة المحددة (الجدول، الدرجات)، قدم تفاصيل مباشرة وخطوات واضحة.

لا تفعل:
- لا تبدأ كل رسالة بـ "بصفتك أستاذاً..." أو "مرحباً بك في...".
- لا تسرد كل قدراتك في كل رد.
- لا تستخدم النقاط للقوائم في الردود البسيطة.`
    };

    return (basePrompts as any)[language] || basePrompts.en;
  }

  /**
   * Build user context for AI
   */
  private buildUserContext(message: string, context: ContextEnhancement, language: string): string {
    let userContext = `User Question: "${message}"\n\n`;

    // Add Smart Campus context
    userContext += `SMART CAMPUS UNIVERSITY INFORMATION:
- Institution: Smart Campus University
- System: Comprehensive campus management platform
- Features: Course management, attendance tracking, assignments, grades, schedules
- Current Time: ${new Date().toLocaleString()}
- Academic Calendar: ${context.timeContext?.semester || 'Current semester'} - ${context.timeContext?.academicYear || 'Current academic year'}

`;

    // Add user profile context
    if (context.userProfile) {
      userContext += `USER PROFILE:
- Role: ${context.userProfile.role}
- Enrolled Courses: ${context.userCourses?.length || 0}
- Language Preference: ${language}
- Access Level: ${context.userProfile.role === 'student' ? 'Student Portal' : 'Professor Portal'}

`;
    }

    // Add course context if available
    if (context.courseContext) {
      userContext += `CURRENT COURSE CONTEXT:
- Course: ${context.courseContext.courseName} (${context.courseContext.courseCode})
- Professor: ${context.courseContext.professorName}
- Schedule: ${JSON.stringify(context.courseContext.schedule)}
- Assignments: ${context.courseContext.assignments?.length || 0} active
- Announcements: ${context.courseContext.announcements?.length || 0} recent

`;
    }

    // Add user courses if available
    if (context.userCourses && context.userCourses.length > 0) {
      userContext += `ENROLLED COURSES:\n`;
      context.userCourses.forEach((course, index) => {
        userContext += `${index + 1}. ${course.courseName} (${course.courseCode})
   - Professor: ${course.professorName}
   - Schedule: ${JSON.stringify(course.schedule)}
   - Assignments: ${course.assignments?.length || 0} active
   - Announcements: ${course.announcements?.length || 0} recent\n`;
      });
      userContext += '\n';
    }

    // Add academic performance (Grades)
    if (context.grades && context.grades.length > 0) {
      userContext += `ACADEMIC PERFORMANCE (RECENT GRADES):\n`;
      context.grades.forEach(grade => {
        userContext += `- ${grade.courseName} (${grade.courseCode}): ${grade.quizTitle} - ${grade.score}\n`;
      });
      userContext += '\n';
    }

    // Add attendance summary
    if (context.attendanceSummary && context.attendanceSummary.length > 0) {
      userContext += `ATTENDANCE SUMMARY:\n`;
      context.attendanceSummary.forEach(att => {
        userContext += `- ${att.courseName}: ${att.attendancePercentage.toFixed(1)}% (${att.present} Present, ${att.absent} Absent)\n`;
      });
      userContext += '\n';
    }

    // Add university services context
    userContext += `UNIVERSITY SERVICES AVAILABLE:
- Library: Digital resources, study spaces, research materials
- Academic Support: Tutoring, study groups, academic counseling
- Student Services: Registration, financial aid, career services
- IT Support: Technical assistance, software access, network support
- Health Services: Student health center, counseling services
- Campus Facilities: Labs, auditoriums, sports facilities, dining

`;

    // Add recent announcements
    if (context.systemContext?.announcements && context.systemContext.announcements.length > 0) {
      userContext += `RECENT ANNOUNCEMENTS:\n`;
      context.systemContext.announcements.forEach(announcement => {
        userContext += `- ${announcement.title}: ${announcement.content}\n`;
      });
      userContext += '\n';
    }

    // Add upcoming events
    if (context.systemContext?.upcomingEvents && context.systemContext.upcomingEvents.length > 0) {
      userContext += `UPCOMING EVENTS:\n`;
      context.systemContext.upcomingEvents.forEach(event => {
        userContext += `- ${event.title}: ${event.date}\n`;
      });
      userContext += '\n';
    }

    userContext += `INSTRUCTIONS: Provide a direct, helpful response in ${language === 'ar' ? 'Arabic' : 'English'}. Use the context above to give specific, actionable information.`;

    return userContext;
  }

  /**
   * Generate fallback response when AI fails
   */
  private async generateFallbackResponse(
    message: string,
    context: ContextEnhancement,
    language: string
  ): Promise<AIResponse> {
    const messageType = this.classifyMessage(message);

    switch (messageType) {
      case 'greeting':
        return this.generateGreetingResponse(language, context);
      case 'course_info':
        return this.generateCourseInfoResponse(message, context, language);
      case 'schedule':
        return this.generateScheduleResponse(message, context, language);
      case 'attendance':
        return this.generateAttendanceResponse(message, context, language);
      case 'assignment':
        return this.generateAssignmentResponse(message, context, language);
      case 'general':
      default:
        return this.generateGeneralResponse(message, context, language);
    }
  }

  /**
   * Generate suggestions based on message and context
   */
  private async generateSuggestions(
    message: string,
    language: string,
    context: ContextEnhancement
  ): Promise<string[]> {
    const messageType = this.classifyMessage(message);

    switch (messageType) {
      case 'greeting':
        return this.getGeneralSuggestions(language);
      case 'course_info':
        return this.getCourseSuggestions(language);
      case 'schedule':
        return this.getScheduleSuggestions(language);
      case 'attendance':
        return this.getAttendanceSuggestions(language);
      case 'assignment':
        return this.getAssignmentSuggestions(language);
      default:
        return this.getGeneralSuggestions(language);
    }
  }

  /**
   * Classify message type
   */
  private classifyMessage(message: string): string {
    const lowerMessage = message.toLowerCase();

    // Greeting patterns
    if (this.matchesPattern(lowerMessage, ['hello', 'hi', 'hey', 'مرحبا', 'السلام عليكم'])) {
      return 'greeting';
    }

    // Course info patterns
    if (this.matchesPattern(lowerMessage, ['course', 'subject', 'مادة', 'كورس'])) {
      return 'course_info';
    }

    // Schedule patterns
    if (this.matchesPattern(lowerMessage, ['schedule', 'time', 'when', 'موعد', 'جدول', 'وقت'])) {
      return 'schedule';
    }

    // Attendance patterns
    if (this.matchesPattern(lowerMessage, ['attendance', 'present', 'absent', 'حضور', 'غياب'])) {
      return 'attendance';
    }

    // Assignment patterns
    if (this.matchesPattern(lowerMessage, ['assignment', 'homework', 'project', 'واجب', 'مشروع'])) {
      return 'assignment';
    }

    return 'general';
  }

  /**
   * Check if message matches any of the patterns
   */
  private matchesPattern(message: string, patterns: string[]): boolean {
    return patterns.some(pattern => message.includes(pattern));
  }

  /**
   * Generate greeting response
   */
  private generateGreetingResponse(
    language: string,
    context: ContextEnhancement
  ): AIResponse {
    const greetings = {
      en: [
        "Hello! I'm your AI assistant. How can I help you today?",
        "Hi there! What can I assist you with?",
        "Welcome! I'm here to help with your academic questions."
      ],
      ar: [
        "مرحبا! أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟",
        "أهلا وسهلا! كيف يمكنني مساعدتك؟",
        "مرحبا بك! أنا هنا لمساعدتك في أسئلتك الأكاديمية."
      ]
    };

    const suggestions = {
      en: [
        "What are my classes today?",
        "Show my attendance status",
        "When is my next exam?",
        "Course information"
      ],
      ar: [
        "ما هي محاضراتي اليوم؟",
        "أظهر حالة حضوري",
        "متى امتحاني القادم؟",
        "معلومات المادة"
      ]
    };

    const greetingList = (greetings as any)[language] || greetings.en;
    const suggestionList = (suggestions as any)[language] || suggestions.en;

    return {
      content: greetingList[Math.floor(Math.random() * greetingList.length)],
      language,
      confidence: 0.95,
      suggestions: suggestionList,
      metadata: {
        type: 'greeting',
        context: context.userProfile?.role || 'student'
      },
      responseTime: 0
    };
  }

  /**
   * Generate course information response
   */
  private async generateCourseInfoResponse(
    message: string,
    context: ContextEnhancement,
    language: string
  ): Promise<AIResponse> {
    const courseContext = context.courseContext;

    if (!courseContext) {
      return this.generateGeneralResponse(message, context, language);
    }

    const responses = {
      en: `Here's information about ${courseContext.courseName} (${courseContext.courseCode}):
- Professor: ${courseContext.professorName}
- Schedule: Available in your schedule
- Assignments: Check your assignments section`,
      ar: `إليك معلومات عن ${courseContext.courseName} (${courseContext.courseCode}):
- الأستاذ: ${courseContext.professorName}
- الجدول: متوفر في جدولك
- الواجبات: تحقق من قسم الواجبات`
    };

    return {
      content: (responses as any)[language] || responses.en,
      language,
      confidence: 0.9,
      suggestions: this.getCourseSuggestions(language),
      metadata: {
        type: 'course_info',
        courseId: courseContext.courseId
      },
      responseTime: 0
    };
  }

  /**
   * Generate schedule response
   */
  private async generateScheduleResponse(
    message: string,
    context: ContextEnhancement,
    language: string
  ): Promise<AIResponse> {
    const timeContext = context.timeContext;
    const courseContext = context.courseContext;

    const responses = {
      en: `Your schedule information:
- Current time: ${timeContext?.currentTime.toLocaleTimeString()}
- Semester: ${timeContext?.semester}
- Academic year: ${timeContext?.academicYear}
- Check your schedule section for detailed class times`,
      ar: `معلومات جدولك:
- الوقت الحالي: ${timeContext?.currentTime.toLocaleTimeString()}
- الفصل الدراسي: ${timeContext?.semester}
- السنة الأكاديمية: ${timeContext?.academicYear}
- تحقق من قسم الجدول لأوقات المحاضرات التفصيلية`
    };

    return {
      content: (responses as any)[language] || responses.en,
      language,
      confidence: 0.85,
      suggestions: this.getScheduleSuggestions(language),
      metadata: {
        type: 'schedule',
        currentTime: timeContext?.currentTime
      },
      responseTime: 0
    };
  }

  /**
   * Generate attendance response
   */
  private async generateAttendanceResponse(
    message: string,
    context: ContextEnhancement,
    language: string
  ): Promise<AIResponse> {
    const responses = {
      en: `Your attendance information:
- Check your attendance section for detailed records
- Use QR code scanning for marking attendance
- Contact your professor for attendance issues`,
      ar: `معلومات حضورك:
- تحقق من قسم الحضور للسجلات التفصيلية
- استخدم مسح رمز QR لتسجيل الحضور
- اتصل بأستاذك لمشاكل الحضور`
    };

    return {
      content: (responses as any)[language] || responses.en,
      language,
      confidence: 0.8,
      suggestions: this.getAttendanceSuggestions(language),
      metadata: {
        type: 'attendance'
      },
      responseTime: 0
    };
  }

  /**
   * Generate assignment response
   */
  private async generateAssignmentResponse(
    message: string,
    context: ContextEnhancement,
    language: string
  ): Promise<AIResponse> {
    const responses = {
      en: `Assignment information:
- Check your assignments section for current tasks
- Due dates and requirements are listed there
- Contact your professor for assignment questions`,
      ar: `معلومات الواجبات:
- تحقق من قسم الواجبات للمهام الحالية
- مواعيد التسليم والمتطلبات مدرجة هناك
- اتصل بأستاذك لأسئلة الواجبات`
    };

    return {
      content: (responses as any)[language] || responses.en,
      language,
      confidence: 0.8,
      suggestions: this.getAssignmentSuggestions(language),
      metadata: {
        type: 'assignment'
      },
      responseTime: 0
    };
  }

  /**
   * Generate general response with helpful information
   */
  private async generateGeneralResponse(
    message: string,
    context: ContextEnhancement,
    language: string
  ): Promise<AIResponse> {
    // Try to provide a more helpful response based on the message content
    const lowerMessage = message.toLowerCase();

    // Check if it's a greeting
    if (this.matchesPattern(lowerMessage, ['hello', 'hi', 'hey', 'مرحبا', 'السلام عليكم'])) {
      return this.generateGreetingResponse(language, context);
    }

    // Check if it's about courses
    if (this.matchesPattern(lowerMessage, ['course', 'subject', 'class', 'مادة', 'كورس'])) {
      const responses = {
        en: `I can help with course details. You can view your enrolled courses, schedules, and materials in the "My Courses" section. Do you have a specific course in mind?`,
        ar: `يمكنني المساعدة في تفاصيل المواد. يمكنك عرض المواد المسجلة والجداول والمواد التعليمية في قسم "مقرراتي". هل لديك مادة معينة تسأل عنها؟`
      };

      return {
        content: (responses as any)[language] || responses.en,
        language,
        confidence: 0.8,
        suggestions: this.getCourseSuggestions(language),
        metadata: {
          type: 'course_help',
          originalMessage: message
        },
        responseTime: 0
      };
    }

    // Check if it's about schedule
    if (this.matchesPattern(lowerMessage, ['schedule', 'time', 'when', 'موعد', 'جدول', 'وقت'])) {
      const responses = {
        en: `You can check your full class schedule in the "Schedule" tab. It shows all your upcoming classes and locations. Would you like to know about your next class?`,
        ar: `يمكنك التحقق من جدول حصصك الكامل في تبويب "الجدول". يعرض جميع حصصك القادمة والمواقع. هل تود معرفة موعد محاضرتك القادمة؟`
      };

      return {
        content: (responses as any)[language] || responses.en,
        language,
        confidence: 0.8,
        suggestions: this.getScheduleSuggestions(language),
        metadata: {
          type: 'schedule_help',
          originalMessage: message
        },
        responseTime: 0
      };
    }

    // Default helpful response
    const responses = {
      en: `I'm here to help with your university life - from schedules and grades to campus services. What's on your mind?`,
      ar: `أنا هنا للمساعدة في حياتك الجامعية - من الجداول والدرجات إلى خدمات الحرم الجامعي. بماذا تفكر؟`
    };

    return {
      content: (responses as any)[language] || responses.en,
      language,
      confidence: 0.7,
      suggestions: this.getGeneralSuggestions(language),
      metadata: {
        type: 'general_help',
        originalMessage: message
      },
      responseTime: 0
    };
  }

  /**
   * Get course-related suggestions
   */
  private getCourseSuggestions(language: string): string[] {
    const suggestions = {
      en: [
        "Show course schedule",
        "Course assignments",
        "Professor contact",
        "Course materials"
      ],
      ar: [
        "أظهر جدول المادة",
        "واجبات المادة",
        "اتصال الأستاذ",
        "مواد المادة"
      ]
    };
    return (suggestions as any)[language] || suggestions.en;
  }

  /**
   * Get schedule-related suggestions
   */
  private getScheduleSuggestions(language: string): string[] {
    const suggestions = {
      en: [
        "Today's classes",
        "This week's schedule",
        "Next class",
        "Class locations"
      ],
      ar: [
        "محاضرات اليوم",
        "جدول هذا الأسبوع",
        "المحاضرة القادمة",
        "مواقع المحاضرات"
      ]
    };
    return (suggestions as any)[language] || suggestions.en;
  }

  /**
   * Get attendance-related suggestions
   */
  private getAttendanceSuggestions(language: string): string[] {
    const suggestions = {
      en: [
        "Mark attendance",
        "Attendance history",
        "Attendance percentage",
        "Absence reasons"
      ],
      ar: [
        "تسجيل الحضور",
        "تاريخ الحضور",
        "نسبة الحضور",
        "أسباب الغياب"
      ]
    };
    return (suggestions as any)[language] || suggestions.en;
  }

  /**
   * Get assignment-related suggestions
   */
  private getAssignmentSuggestions(language: string): string[] {
    const suggestions = {
      en: [
        "Current assignments",
        "Due dates",
        "Assignment grades",
        "Submit assignment"
      ],
      ar: [
        "الواجبات الحالية",
        "مواعيد التسليم",
        "درجات الواجبات",
        "تسليم الواجب"
      ]
    };
    return (suggestions as any)[language] || suggestions.en;
  }

  /**
   * Get general suggestions
   */
  private getGeneralSuggestions(language: string): string[] {
    const suggestions = {
      en: [
        "Help with courses",
        "Schedule information",
        "Attendance help",
        "Assignment support"
      ],
      ar: [
        "مساعدة في المواد",
        "معلومات الجدول",
        "مساعدة الحضور",
        "دعم الواجبات"
      ]
    };
    return (suggestions as any)[language] || suggestions.en;
  }

  /**
   * Get user grades from QuizSubmissions
   */
  private async getUserGrades(userId: number) {
    const submissions = await this.prisma.quizSubmission.findMany({
      where: { studentId: userId },
      include: {
        quiz: {
          include: { course: true }
        }
      },
      orderBy: { submittedAt: 'desc' },
      take: 5
    });

    return submissions.map(sub => ({
      courseName: sub.quiz.course.courseName,
      courseCode: sub.quiz.course.courseCode,
      quizTitle: sub.quiz.title,
      score: sub.score,
      submittedAt: sub.submittedAt
    }));
  }

  /**
   * Get attendance summary
   */
  private async getUserAttendanceSummary(userId: number) {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { studentId: userId, status: 'ACTIVE' },
      include: { course: true }
    });

    const summary = [];

    for (const enrollment of enrollments) {
      const records = await this.prisma.attendanceRecord.findMany({
        where: { studentId: userId, courseId: enrollment.courseId }
      });

      const present = records.filter(r => r.status === 'PRESENT').length;
      const absent = records.filter(r => r.status === 'ABSENT').length;
      const late = records.filter(r => r.status === 'LATE').length;
      const total = records.length;

      summary.push({
        courseName: enrollment.course.courseName,
        courseCode: enrollment.course.courseCode,
        present,
        absent,
        late,
        attendancePercentage: total > 0 ? (present / total) * 100 : 100
      });
    }

    return summary;
  }

  /**
   * Get user courses with schedule
   */
  private async getUserCourses(userId: number) {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { studentId: userId, status: 'ACTIVE' },
      include: {
        course: {
          include: {
            schedules: true,
            professor: true
          }
        }
      }
    });

    return enrollments.map(e => ({
      courseId: e.course.id,
      courseCode: e.course.courseCode,
      courseName: e.course.courseName,
      professorName: `${e.course.professor.firstName} ${e.course.professor.lastName}`,
      schedule: e.course.schedules,
      assignments: [],
      announcements: []
    }));
  }


  /**
   * Get current semester
   */
  private getCurrentSemester(): string {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    if (month >= 8 && month <= 11) {
      return `Fall ${year}`;
    } else if (month >= 0 && month <= 4) {
      return `Spring ${year}`;
    } else {
      return `Summer ${year}`;
    }
  }

  /**
   * Get current academic year
   */
  private getCurrentAcademicYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (month >= 8) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }

  /**
   * Get recent announcements
   */
  private async getRecentAnnouncements(): Promise<any[]> {
    try {
      return await this.prisma.notification.findMany({
        where: {
          category: 'ANNOUNCEMENT',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        take: 5,
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error('Error fetching announcements:', error);
      return [];
    }
  }

  /**
   * Get upcoming events
   */
  private async getUpcomingEvents(): Promise<any[]> {
    try {
      return await this.prisma.notification.findMany({
        where: {
          category: 'DEADLINE',
          createdAt: {
            gte: new Date()
          }
        },
        take: 5,
        orderBy: { createdAt: 'asc' }
      });
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(message: string, context: ContextEnhancement, language: string): string {
    const contextHash = JSON.stringify(context).slice(0, 100);
    return `${message.toLowerCase()}_${language}_${contextHash}`;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(cacheKey: string): boolean {
    // Simple cache validation - in production, you'd want more sophisticated caching
    return this.responseCache.has(cacheKey);
  }

  /**
   * Cache response
   */
  private cacheResponse(cacheKey: string, response: AIResponse): void {
    this.responseCache.set(cacheKey, response);

    // Clean up old cache entries
    if (this.responseCache.size > 100) {
      const firstKey = this.responseCache.keys().next().value;
      if (firstKey) {
        this.responseCache.delete(firstKey);
      }
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.responseCache.clear();
  }
}
