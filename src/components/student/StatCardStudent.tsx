import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardStudentProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  delay?: number;
  subtitle?: string;
}

export default function StatCardStudent({
  title,
  value,
  icon: Icon,
  color,
  delay = 0,
  subtitle
}: StatCardStudentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{
        scale: 1.02,
        y: -5,
        transition: { duration: 0.2 }
      }}
      className="relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/30 p-4 sm:p-6 group"
      tabIndex={0}
      role="article"
      aria-label={`${title}: ${value}${subtitle ? ` ${subtitle}` : ''}`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-white/20 dark:from-white/5 dark:to-white/10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 duration-500" />

      <div className="relative flex items-center justify-between z-10">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 tracking-wide uppercase">{title}</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</span>
            {subtitle && (
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{subtitle}</span>
            )}
          </div>
        </div>
        <div className={`p-3.5 rounded-xl ${color} shadow-lg group-hover:scale-110 transition-transform duration-300 ring-4 ring-white/50 dark:ring-gray-800/50 shrink-0`}>
          <Icon className="w-6 h-6" strokeWidth={2} />
        </div>
      </div>
    </motion.div>
  );
}

