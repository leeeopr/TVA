'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useEmotionStore, EmotionType } from '@/stores/emotionStore';
import { useProductivityStore } from '@/stores/productivityStore';
import { sounds } from '@/lib/sounds';
import { Terminal, ShieldAlert, Check } from 'lucide-react';

export default function EmotionCheckinModal() {
  const { hasAnsweredToday, shuffledEmotions, logTodayEmotion, loading, fetchHistory } = useEmotionStore();
  const { settings } = useProductivityStore();
  
  // Terminal text simulation state
  const [booting, setBooting] = useState(true);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [showQuestion, setShowQuestion] = useState(false);
  const [selectedKey, setSelectedKey] = useState<EmotionType | null>(null);
  const [completedAnimation, setCompletedAnimation] = useState(false);

  // Sync / verify check-in requirements upon load
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Boot text generation for that Loki / TVA Terminal atmosphere
  useEffect(() => {
    if (hasAnsweredToday) return;

    // Reset loop variables using async tick
    const initTimer = setTimeout(() => {
      setBooting(true);
      setShowQuestion(false);
      setCompletedAnimation(false);
      setBootLines([]);
    }, 0);

    const lines = [
      'RETRO_OS COGNITIVE DIAGNOSTIC UNIT [READY]',
      'UPLINK: ESTABLISHING SECURE MEMORY BUFFER...',
      'DIAGNOSTIC: READING HEART-RATE/PULSE INDICATION... OK',
      'SUBJECT DETECTED: TVA OPERATOR COHORT v4.02',
      'INITIATING COGNITIVE DISPOSITION EVALUATION...',
      '------------------------------------------------',
      'WARNING: CHOOSE WITH MINDFUL REFLECTION',
    ];

    let currentLineIndex = 0;
    let interval: NodeJS.Timeout;

    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        if (currentLineIndex < lines.length) {
          const lineStr = lines[currentLineIndex];
          setBootLines((prev) => [...prev, lineStr]);
          sounds.playKeyClick();
          currentLineIndex++;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setBooting(false);
            setShowQuestion(true);
            sounds.playButtonSwitch();
          }, 600);
        }
      }, 300);
    }, 50);

    return () => {
      clearTimeout(initTimer);
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
    };
  }, [hasAnsweredToday]);

  if (hasAnsweredToday && !completedAnimation) {
    return null;
  }

  // Get current active theme parameters
  const glowColor = 
    settings.theme_mode === 'AMBER' 
      ? 'rgba(255, 179, 71, 0.45)' 
      : settings.theme_mode === 'GREEN' 
        ? 'rgba(51, 255, 51, 0.45)' 
        : 'rgba(0, 229, 255, 0.45)';

  const activeColor = 
    settings.theme_mode === 'AMBER' 
      ? '#ffb347' 
      : settings.theme_mode === 'GREEN' 
        ? '#33ff33' 
        : '#00e5ff';

  const hoverBg =
    settings.theme_mode === 'AMBER'
      ? 'hover:bg-[#ffb347]/10'
      : settings.theme_mode === 'GREEN'
        ? 'hover:bg-[#33ff33]/10'
        : 'hover:bg-[#00e5ff]/10';

  const outlineStyle = 
    settings.theme_mode === 'AMBER' 
      ? 'border-[#ffb347] shadow-[0_0_15px_rgba(255,179,71,0.2)]' 
      : settings.theme_mode === 'GREEN' 
        ? 'border-[#33ff33] shadow-[0_0_15px_rgba(51,255,51,0.2)]' 
        : 'border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.2)]';

  const scanlineClass = settings.scanlines_enabled ? 'crt-scanlines' : '';

  const handleSelectEmotion = async (key: EmotionType) => {
    if (loading || selectedKey) return;
    setSelectedKey(key);
    sounds.playButtonSwitch();
    
    // Smooth submit flow
    setTimeout(async () => {
      const success = await logTodayEmotion(key);
      if (success) {
        sounds.playAlarmFocusComplete();
        setCompletedAnimation(true);
        setTimeout(() => {
          // Finished, remove overlay
        }, 1000);
      }
    }, 700);
  };

  return (
    <AnimatePresence>
      {(!hasAnsweredToday || (selectedKey && !completedAnimation)) && (
        <motion.div
          id="emotion-checkin-fullscreen-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          style={{ '--color-amber': activeColor, '--color-amber-glow': glowColor } as React.CSSProperties}
          className="fixed inset-0 z-[10000] bg-[#040302] p-6 font-mono crt-container flex flex-col items-center justify-center select-none overflow-y-auto"
        >
          {/* Scanline layer overlays */}
          <div className={scanlineClass} />
          <div className="crt-vignette pointer-events-none" />
          <div className="phosphor-beam pointer-events-none" />

          {/* Core frame containing our evaluation */}
          <div className="w-full max-w-4xl flex flex-col justify-between min-h-[85vh] md:min-h-[75vh] border-2 p-6 md:p-10 rounded-2xl bg-[#090706] relative z-10 transition-colors duration-500 overflow-hidden"
               style={{ borderColor: activeColor, boxShadow: `0 0 35px ${glowColor}` }}>
            
            {/* Corner Decorative Terminal Signatures */}
            <div className="absolute top-3 left-4 text-[10px] tracking-widest opacity-60 flex items-center gap-1.5" style={{ color: activeColor }}>
              <Terminal className="w-3.5 h-3.5 animate-pulse" />
              <span>COGNITIVE RECORDING TERMINAL [SECURE]</span>
            </div>
            <div className="absolute top-3 right-4 text-[10px] tracking-widest opacity-60" style={{ color: activeColor }}>
              <span>SYSTEM: RETRO_OS v4.02</span>
            </div>

            {/* Booting Terminal Steps Sequence */}
            {booting && (
              <div className="flex-1 flex flex-col justify-center items-start space-y-2 font-mono text-xs md:text-sm md:pl-6 leading-relaxed select-none">
                {bootLines.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ color: activeColor }}
                  >
                    {line && typeof line === 'string' && line.startsWith('WARNING') ? (
                      <span className="flex items-center gap-1.5 text-red-500 font-bold tracking-widest">
                        <ShieldAlert className="w-4 h-4" />
                        {line}
                      </span>
                    ) : (
                      <span>{`> ${line || ''}`}</span>
                    )}
                  </motion.div>
                ))}
                <motion.span 
                  animate={{ opacity: [1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-2 h-4 pl-1"
                  style={{ backgroundColor: activeColor }}
                />
              </div>
            )}

            {/* Main traditional Chinese prompt & card selectors selection layout */}
            {showQuestion && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="flex-1 flex flex-col justify-center my-6 space-y-10 w-full"
              >
                {/* Visual Title Prompt Header */}
                <div className="text-center space-y-4">
                  <motion.h2 
                    initial={{ scale: 0.96 }}
                    animate={{ scale: 1 }}
                    className="text-4xl md:text-6xl font-black tracking-widest text-[#ffffff] font-extrabold select-none"
                    style={{ textShadow: `0 0 15px ${activeColor}` }}
                  >
                    「你今天感覺如何？」
                  </motion.h2>
                  <p className="text-xs tracking-[0.3em] font-medium" style={{ color: activeColor }}>
                    CONTEMPLATIVE ATMOSPHERE // RECONSTRUCT EMOTIONAL COMPLIANCE
                  </p>
                </div>

                {/* 5 Elegant Chinese emotional options responsive Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mt-8 max-w-4xl mx-auto w-full">
                  {shuffledEmotions.map((emo) => {
                    const isSelected = selectedKey === emo.key;
                    const someSelected = selectedKey !== null;

                    return (
                      <motion.button
                        key={emo.key}
                        onClick={() => handleSelectEmotion(emo.key)}
                        disabled={someSelected}
                        whileHover={!someSelected ? { scale: 1.04, y: -2 } : {}}
                        whileTap={!someSelected ? { scale: 0.98 } : {}}
                        className={`aspect-square p-4 border-2 rounded-xl flex flex-col justify-center items-center gap-3 bg-transparent cursor-pointer transition-all duration-300 relative overflow-hidden select-none ${outlineStyle} ${hoverBg}`}
                        style={{
                          borderColor: isSelected ? activeColor : undefined,
                          backgroundColor: isSelected ? `${activeColor}15` : undefined,
                          opacity: someSelected && !isSelected ? 0.35 : 1,
                        }}
                      >
                        {/* Dynamic selector checkmark wrapper */}
                        {isSelected && (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-2 right-2 p-1 rounded-full text-black flex items-center justify-center aspect-square"
                            style={{ backgroundColor: activeColor }}
                          >
                            <Check className="w-3 h-3" />
                          </motion.div>
                        )}

                        {/* Large traditional Chinese labels */}
                        <span className="text-3xl md:text-4xl font-black select-none tracking-widest text-[#ffffff]">
                          {emo.labelZh}
                        </span>
                        
                        {/* Mandarin Pinyin pronunciation guide underneath */}
                        <span className="text-xs md:text-sm font-medium select-none tracking-wider opacity-60 italic" style={{ color: activeColor }}>
                          {emo.pinyin}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Bottom operational status bar */}
            <div className="flex justify-between items-center border-t pt-4 text-[9px] tracking-wider font-semibold uppercase opacity-60"
                 style={{ borderTopColor: `${activeColor}30`, color: activeColor }}>
              <span>PROMPT SEQUENCE: DICT-4001</span>
              <span>NOポルトガル語 // NO ENGLISH // TRADITIONAL ONLY</span>
              <span>COGNITION CORES ENGAGED.</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
