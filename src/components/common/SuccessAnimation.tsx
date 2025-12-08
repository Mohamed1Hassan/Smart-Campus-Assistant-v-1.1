import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';

interface SuccessAnimationProps {
    isVisible: boolean;
    onClose: () => void;
    message?: string;
    subMessage?: string;
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
    isVisible,
    onClose,
    message = "Attendance Recorded!",
    subMessage = "You have successfully checked in for this session."
}) => {
    // Simple particle system
    const particles = Array.from({ length: 20 });

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 50 }}
                        transition={{ type: "spring", damping: 15, stiffness: 300 }}
                        className="relative bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center overflow-hidden"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-20"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Confetti Particles */}
                        {particles.map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{
                                    x: 0,
                                    y: 0,
                                    opacity: 1,
                                    scale: Math.random() * 0.5 + 0.5
                                }}
                                animate={{
                                    x: (Math.random() - 0.5) * 400,
                                    y: (Math.random() - 0.5) * 400,
                                    opacity: 0,
                                    rotate: Math.random() * 360
                                }}
                                transition={{
                                    duration: 2,
                                    ease: "easeOut",
                                    delay: 0.2
                                }}
                                className={`absolute top-1/2 left-1/2 w-3 h-3 rounded-full ${['bg-green-400', 'bg-blue-400', 'bg-yellow-400', 'bg-purple-400'][Math.floor(Math.random() * 4)]
                                    }`}
                            />
                        ))}

                        {/* Animated Checkmark Circle */}
                        <div className="relative mb-6 mx-auto w-24 h-24 flex items-center justify-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                                className="absolute inset-0 bg-green-100 dark:bg-green-900/30 rounded-full"
                            />
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                className="absolute inset-2 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30"
                            >
                                <motion.div
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 1 }}
                                    transition={{ delay: 0.4, duration: 0.5 }}
                                >
                                    <Check className="w-12 h-12 text-white stroke-[3]" />
                                </motion.div>
                            </motion.div>
                        </div>

                        {/* Text Content */}
                        <motion.h2
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="text-2xl font-bold text-gray-900 dark:text-white mb-2"
                        >
                            {message}
                        </motion.h2>

                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="text-gray-500 dark:text-gray-400 mb-8"
                        >
                            {subMessage}
                        </motion.p>

                        {/* Action Button */}
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 }}
                            onClick={onClose}
                            className="w-full py-3 px-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-green-500/25 transition-all transform active:scale-95"
                        >
                            Start Learning
                        </motion.button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
