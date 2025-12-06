import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Bot, Sparkles, Brain, Globe, Zap, XCircle } from 'lucide-react';
import DashboardLayout from '../components/common/DashboardLayout';
import ChatContainer from '../components/student/chatbot/ChatContainer';
import QuickPrompts from '../components/student/chatbot/QuickPrompts';
import { useChat } from '../components/student/chatbot/hooks/useChat';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

export default function StudentChatbot() {
  const { user } = useAuth();
  const { sendMessage, endSession } = useChat();
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);

  // Reset scroll position to top when page loads
  useEffect(() => {
    // Use a small delay to ensure all components are rendered
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <DashboardLayout
      userName={user ? `${user.firstName} ${user.lastName}` : "Student"}
      userType="student"
    >
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-textDark mb-2">
            Smart Campus Assistant
          </h1>
          <p className="text-gray-600 dark:text-mutedDark">
            Your AI-powered university companion for all academic needs
          </p>
        </div>

        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to end this session? This will clear your chat history.')) {
              endSession();
              toast.success('Session ended');
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors self-start md:self-center"
        >
          <XCircle className="w-5 h-5" />
          <span className="font-medium">End Session</span>
        </button>
      </motion.div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white dark:bg-cardDark rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-mutedDark mb-2">AI Responses</h3>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold text-gray-900 dark:text-textDark">24/7</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-blue-500">
              <Brain className="w-6 h-6 text-white" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white dark:bg-cardDark rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-mutedDark mb-2">Languages</h3>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold text-gray-900 dark:text-textDark">2</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-green-500">
              <Globe className="w-6 h-6 text-white" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-white dark:bg-cardDark rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-mutedDark mb-2">Response Time</h3>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold text-gray-900 dark:text-textDark">&lt;1s</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-orange-500">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white dark:bg-cardDark rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-mutedDark mb-2">Knowledge Base</h3>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold text-gray-900 dark:text-textDark">15+</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-purple-500">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
        {/* Chat Container - Takes 3 columns on large screens, or 4 if sidebar closed */}
        <div className={showQuickPrompts ? "lg:col-span-3" : "lg:col-span-4"}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white dark:bg-cardDark rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden h-[600px]"
          >
            <ChatContainer className="h-full" />
          </motion.div>
        </div>

        {/* Quick Prompts Sidebar - Takes 1 column on large screens */}
        <div className="lg:col-span-1">
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className={`hidden ${showQuickPrompts ? 'lg:block' : 'lg:hidden'}`}
          >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-textDark">Quick Prompts</h3>
            <button
              onClick={() => setShowQuickPrompts(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              aria-label="Close sidebar"
              title="Close Sidebar"
            >
              <XCircle className="w-5 h-5 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" />
            </button>
          </div>
          <QuickPrompts onPromptClick={handleQuickPrompt} />
        </motion.div>
      </div>
    </div>

      {/* Mobile/Desktop Quick Prompts Toggle */ }
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.4 }}
    className={`mt-6 ${showQuickPrompts ? 'lg:hidden' : 'block'}`}
  >
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setShowQuickPrompts(!showQuickPrompts)}
      className="w-full lg:w-auto flex items-center justify-center gap-2 p-3 bg-white dark:bg-cardDark border border-gray-100 dark:border-gray-700 rounded-xl hover:shadow-md transition-all duration-200 px-6 mx-auto"
    >
      <Sparkles className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      <span className="text-sm font-medium text-gray-700 dark:text-textDark">
        {showQuickPrompts ? 'Hide' : 'Show'} Quick Prompts
      </span>
    </motion.button>

    {showQuickPrompts && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mt-4"
      >
        <QuickPrompts onPromptClick={handleQuickPrompt} />
      </motion.div>
    )}
  </motion.div>

  {/* Features Info */ }
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.6 }}
    className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
  >
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full" />
        <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300">
          Smart Responses
        </h3>
      </div>
      <p className="text-xs text-blue-600 dark:text-blue-400">
        Get instant answers from our knowledge base or AI-powered responses
      </p>
    </div>

    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-green-500 rounded-full" />
        <h3 className="text-sm font-semibold text-green-700 dark:text-green-300">
          Multilingual
        </h3>
      </div>
      <p className="text-xs text-green-600 dark:text-green-400">
        Supports both English and Arabic with automatic language detection
      </p>
    </div>

    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-purple-500 rounded-full" />
        <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
          Always Available
        </h3>
      </div>
      <p className="text-xs text-purple-600 dark:text-purple-400">
        24/7 assistance for all your university-related questions
      </p>
    </div>
  </motion.div>
    </DashboardLayout >
  );
}
