import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, Heart } from 'lucide-react';

interface AIAssistantButtonProps {
    userType: 'student' | 'professor';
}

export const AIAssistantButton: React.FC<AIAssistantButtonProps> = ({ userType }) => {
    const navigate = useNavigate();
    const [isHovered, setIsHovered] = useState(false);

    // Use a ref to track if an animation is currently playing
    // This persists across renders and doesn't trigger re-renders itself
    const isBusy = React.useRef(false);

    // Robot State
    const [robotState, setRobotState] = useState({
        eyeX: 0,
        eyeY: 0,
        leftEyeY: 0,
        rightEyeY: 0,
        eyeScaleY: 1,
        eyeScaleX: 1,
        headRotate: 0,
        bodyY: 0,
        blink: false,
        winkLeft: false,
        winkRight: false,
        isSpinning: false,
        isShaking: false,
        // New Creative States
        isSleeping: false,
        isTalking: false,
        showIdea: false,
        showLove: false,
        isGlitching: false,
        // New Variety States
        isDizzy: false,
        isShocked: false
    });

    // Reset state helper
    const resetState = () => {
        setRobotState({
            eyeX: 0, eyeY: 0, leftEyeY: 0, rightEyeY: 0, eyeScaleY: 1, eyeScaleX: 1,
            headRotate: 0, bodyY: 0, blink: false, winkLeft: false, winkRight: false,
            isSpinning: false, isShaking: false, isSleeping: false, isTalking: false,
            showIdea: false, showLove: false, isGlitching: false,
            isDizzy: false, isShocked: false
        });
        isBusy.current = false;
    };

    // Idle Animation Loop
    useEffect(() => {
        if (isHovered) {
            resetState();
            return;
        }

        const triggerRandomAction = () => {
            if (isBusy.current) return;

            const choice = Math.random();
            isBusy.current = true; // Mark as busy immediately

            // --- Creative Actions (Reduced Frequency: ~12%) ---
            if (choice < 0.02) {
                // Idea (Lightbulb) - 2%
                setRobotState(prev => ({ ...prev, showIdea: true, eyeScaleY: 1.2 }));
                setTimeout(() => {
                    setRobotState(prev => ({ ...prev, showIdea: false, eyeScaleY: 1 }));
                    isBusy.current = false;
                }, 2500);
            }
            else if (choice < 0.04) {
                // Love (Hearts) - 2%
                setRobotState(prev => ({ ...prev, showLove: true, bodyY: -5 }));
                setTimeout(() => {
                    setRobotState(prev => ({ ...prev, showLove: false, bodyY: 0 }));
                    isBusy.current = false;
                }, 2500);
            }
            else if (choice < 0.07) {
                // Sleeping (Zzz) - 3% (Long duration)
                setRobotState(prev => ({ ...prev, isSleeping: true, headRotate: 10, eyeScaleY: 0.1 }));
                setTimeout(() => {
                    setRobotState(prev => ({ ...prev, isSleeping: false, headRotate: 0, eyeScaleY: 1 }));
                    isBusy.current = false;
                }, 4500);
            }
            else if (choice < 0.10) {
                // Talking (Blah Blah) - 3%
                setRobotState(prev => ({ ...prev, isTalking: true }));
                setTimeout(() => {
                    setRobotState(prev => ({ ...prev, isTalking: false }));
                    isBusy.current = false;
                }, 2500);
            }
            else if (choice < 0.12) {
                // Glitch - 2%
                setRobotState(prev => ({ ...prev, isGlitching: true }));
                setTimeout(() => {
                    setRobotState(prev => ({ ...prev, isGlitching: false }));
                    isBusy.current = false;
                }, 300);
            }

            // --- New Variety Actions (~10%) ---
            else if (choice < 0.17) {
                // Dizzy (Eyes rotating) - 5%
                setRobotState(prev => ({ ...prev, isDizzy: true, headRotate: 5 }));
                setTimeout(() => {
                    setRobotState(prev => ({ ...prev, isDizzy: false, headRotate: 0 }));
                    isBusy.current = false;
                }, 1500);
            }
            else if (choice < 0.22) {
                // Shocked (Big eyes + shake) - 5%
                setRobotState(prev => ({ ...prev, isShocked: true, isShaking: true }));
                setTimeout(() => {
                    setRobotState(prev => ({ ...prev, isShocked: false, isShaking: false }));
                    isBusy.current = false;
                }, 800);
            }

            // --- Standard Actions (~78%) ---
            else if (choice < 0.35) {
                // Spin
                setRobotState(prev => ({ ...prev, isSpinning: true }));
                setTimeout(() => {
                    setRobotState(prev => ({ ...prev, isSpinning: false }));
                    isBusy.current = false;
                }, 1000);
            }
            else if (choice < 0.45) {
                // Jump
                setRobotState(prev => ({ ...prev, bodyY: -15 }));
                setTimeout(() => {
                    setRobotState(prev => ({ ...prev, bodyY: 0 }));
                    isBusy.current = false;
                }, 300);
            }
            else if (choice < 0.55) {
                // Confused
                setRobotState(prev => ({ ...prev, leftEyeY: -3, rightEyeY: 3, headRotate: 10 }));
                setTimeout(() => {
                    setRobotState(prev => ({ ...prev, leftEyeY: 0, rightEyeY: 0, headRotate: 0 }));
                    isBusy.current = false;
                }, 1500);
            }
            else if (choice < 0.65) {
                // Shake
                setRobotState(prev => ({ ...prev, isShaking: true }));
                setTimeout(() => {
                    setRobotState(prev => ({ ...prev, isShaking: false }));
                    isBusy.current = false;
                }, 500);
            }
            else if (choice < 0.80) {
                // Scanning
                const x = (Math.random() > 0.5 ? 1 : -1) * 12;
                setRobotState(prev => ({ ...prev, eyeX: x }));
                setTimeout(() => {
                    setRobotState(prev => ({ ...prev, eyeX: -x }));
                    setTimeout(() => {
                        setRobotState(prev => ({ ...prev, eyeX: 0 }));
                        isBusy.current = false;
                    }, 500);
                }, 500);
            }
            else {
                // Double Blink
                setRobotState(prev => ({ ...prev, blink: true }));
                setTimeout(() => {
                    setRobotState(prev => ({ ...prev, blink: false }));
                    setTimeout(() => {
                        setRobotState(prev => ({ ...prev, blink: true }));
                        setTimeout(() => {
                            setRobotState(prev => ({ ...prev, blink: false }));
                            isBusy.current = false;
                        }, 150);
                    }, 100);
                }, 150);
            }
        };

        const timeoutId = setTimeout(function run() {
            triggerRandomAction();
            const nextDelay = Math.random() * 4000 + 5000; // 5 to 9 seconds delay
            setTimeout(run, nextDelay);
        }, 2000);

        return () => clearTimeout(timeoutId);
    }, [isHovered]);

    const handleClick = () => {
        navigate(`/${userType}-chatbot`);
    };

    return (
        <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 flex flex-col items-end gap-4 pointer-events-none">
            {/* Chat Bubble Hint */}
            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, x: 20, scale: 0.8, rotate: 5 }}
                        animate={{ opacity: 1, x: 0, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, x: 10, scale: 0.8 }}
                        className="mb-4 mr-2 pointer-events-auto origin-bottom-right"
                    >
                        <div className="bg-white text-gray-800 px-4 py-2 rounded-2xl rounded-br-none shadow-xl border-2 border-indigo-100 font-bold text-sm flex items-center gap-2">
                            <span className="text-xl">👋</span> How can I help?
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* The 3D Robot Character */}
            <motion.button
                onClick={handleClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="relative pointer-events-auto w-24 h-24 focus:outline-none flex flex-col items-center justify-center scale-50 sm:scale-100 origin-bottom-right"
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                whileHover={{ scale: 1.1, rotate: -5 }}
                whileTap={{ scale: 0.9 }}
            >
                {/* Global Float Animation Wrapper */}
                <motion.div
                    animate={{
                        y: isHovered ? [0, -10, 0] : [0, -5, 0],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="relative w-full h-full flex flex-col items-center justify-center"
                >
                    {/* --- HEAD (Existing) --- */}
                    <motion.div
                        animate={{
                            rotate: robotState.headRotate,
                            y: robotState.bodyY,
                            x: (robotState.isShaking || robotState.isGlitching) ? [-2, 2, -2, 2, 0] : 0,
                            filter: robotState.isGlitching ? "hue-rotate(90deg) contrast(1.5)" : "none"
                        }}
                        transition={{
                            rotate: { type: "spring", stiffness: 200, damping: 20 },
                            y: { type: "spring", stiffness: 300, damping: 20 },
                            x: { duration: 0.1 }
                        }}
                        className="relative w-24 h-20 z-20" // Head is z-20 to sit above body
                    >
                        {/* Antenna */}
                        <motion.div
                            className="absolute -top-3 left-1/2 -translate-x-1/2 w-1 h-4 bg-gray-400 rounded-full origin-bottom"
                            animate={{ rotate: isHovered ? [0, 20, -20, 0] : [0, 5, -5, 0] }}
                            transition={{ duration: isHovered ? 0.2 : 2, repeat: Infinity }}
                        >
                            <motion.div
                                className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm"
                                animate={{
                                    backgroundColor: (isHovered || robotState.showIdea) ? ["#ef4444", "#22c55e", "#ef4444"] : ["#ef4444", "#ff0000", "#ef4444"],
                                    scale: (isHovered || robotState.showIdea) ? [1, 1.3, 1] : 1
                                }}
                                transition={{ duration: (isHovered || robotState.showIdea) ? 0.5 : 1, repeat: Infinity }}
                            />
                        </motion.div>

                        {/* Head Shape (Face) */}
                        <div className="absolute inset-0 bg-white rounded-[2rem] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3),0_8px_10px_-6px_rgba(0,0,0,0.1)] border-4 border-white overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-gray-100" />

                            {/* Screen/Visor Area */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] bg-gray-900 rounded-2xl shadow-inner flex items-center justify-center gap-3 overflow-hidden">
                                {/* Screen Reflection */}
                                <div className="absolute -top-2 -right-2 w-10 h-10 bg-white opacity-10 rounded-full blur-sm" />

                                {/* Left Eye */}
                                <motion.div
                                    className="w-3 h-5 bg-blue-400 shadow-[0_0_10px_#60a5fa]"
                                    style={{ borderRadius: (isHovered || robotState.showLove) ? '50% 50% 0 0' : '9999px' }}
                                    animate={{
                                        x: isHovered ? 0 : (robotState.isDizzy ? [0, 5, 0, -5, 0] : robotState.eyeX),
                                        y: isHovered ? 0 : (robotState.isDizzy ? [5, 0, -5, 0, 5] : robotState.eyeY + robotState.leftEyeY),
                                        scaleY: (robotState.blink || robotState.winkLeft || robotState.isSleeping) ? 0.1 : (isHovered ? 0.8 : (robotState.isShocked ? 1.5 : robotState.eyeScaleY)),
                                        scaleX: robotState.isShocked ? 1.5 : robotState.eyeScaleX,
                                        height: isHovered ? 15 : 20,
                                        backgroundColor: robotState.showLove ? '#ef4444' : '#60a5fa',
                                        boxShadow: robotState.showLove ? '0 0 10px #ef4444' : '0 0 10px #60a5fa'
                                    }}
                                    transition={{
                                        type: "spring", stiffness: 300, damping: 20,
                                        x: robotState.isDizzy ? { duration: 0.5, repeat: Infinity } : {},
                                        y: robotState.isDizzy ? { duration: 0.5, repeat: Infinity, delay: 0.1 } : {}
                                    }}
                                />

                                {/* Right Eye */}
                                <motion.div
                                    className="w-3 h-5 bg-blue-400 shadow-[0_0_10px_#60a5fa]"
                                    style={{ borderRadius: (isHovered || robotState.showLove) ? '50% 50% 0 0' : '9999px' }}
                                    animate={{
                                        x: isHovered ? 0 : (robotState.isDizzy ? [0, -5, 0, 5, 0] : robotState.eyeX),
                                        y: isHovered ? 0 : (robotState.isDizzy ? [-5, 0, 5, 0, -5] : robotState.eyeY + robotState.rightEyeY),
                                        scaleY: (robotState.blink || robotState.winkRight || robotState.isSleeping) ? 0.1 : (isHovered ? 0.8 : (robotState.isShocked ? 1.5 : robotState.eyeScaleY)),
                                        scaleX: robotState.isShocked ? 1.5 : robotState.eyeScaleX,
                                        height: isHovered ? 15 : 20,
                                        backgroundColor: robotState.showLove ? '#ef4444' : '#60a5fa',
                                        boxShadow: robotState.showLove ? '0 0 10px #ef4444' : '0 0 10px #60a5fa'
                                    }}
                                    transition={{
                                        type: "spring", stiffness: 300, damping: 20,
                                        x: robotState.isDizzy ? { duration: 0.5, repeat: Infinity } : {},
                                        y: robotState.isDizzy ? { duration: 0.5, repeat: Infinity, delay: 0.1 } : {}
                                    }}
                                />

                                {/* Mouth (Talking/Happy) */}
                                <motion.div
                                    className="absolute bottom-3 w-4 h-1 bg-blue-400 rounded-full opacity-0"
                                    animate={{
                                        opacity: (isHovered || robotState.isTalking) ? 1 : 0,
                                        scaleX: isHovered ? 1.5 : (robotState.isTalking ? [0.5, 1.2, 0.8, 1.5, 0.5] : 0.5),
                                        scaleY: robotState.isTalking ? [1, 2, 1, 3, 1] : 1,
                                        y: isHovered ? 0 : 5
                                    }}
                                    transition={{ duration: 0.2, repeat: robotState.isTalking ? Infinity : 0 }}
                                />
                            </div>
                        </div>

                        {/* Ears */}
                        <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-3 h-8 bg-gray-300 rounded-l-lg border-l-2 border-white shadow-sm" />
                        <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-3 h-8 bg-gray-300 rounded-r-lg border-r-2 border-white shadow-sm" />
                    </motion.div>



                    {/* Idea Lightbulb - Moved AFTER head and positioned higher */}
                    <AnimatePresence>
                        {robotState.showIdea && (
                            <motion.div
                                initial={{ opacity: 0, y: 0, scale: 0 }}
                                animate={{ opacity: 1, y: -40, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                                className="absolute -top-14 left-[35%] -translate-x-1/2 z-50"
                            >
                                <Lightbulb className="w-10 h-10 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]" />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Sleeping Zzz Particles - Moved AFTER head */}
                    <AnimatePresence>
                        {robotState.isSleeping && (
                            <div className="absolute -top-16 right-0 z-50">
                                {[1, 2, 3].map((i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 0, x: 0 }}
                                        animate={{ opacity: [0, 1, 0], y: -30, x: 15 }}
                                        transition={{ duration: 2, delay: i * 0.6, repeat: Infinity }}
                                        className="absolute text-indigo-400 font-bold text-xl"
                                        style={{ right: i * 5, top: i * 5 }}
                                    >
                                        Z
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Love Hearts - Moved AFTER head and positioned higher */}
                    <AnimatePresence>
                        {robotState.showLove && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1.2, y: -35 }}
                                exit={{ opacity: 0, y: -50 }}
                                className="absolute -top-12 left-[35%] -translate-x-1/2 z-50"
                            >
                                <Heart className="w-8 h-8 text-red-500 fill-red-500 drop-shadow-xl" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.button>
        </div>
    );
};
