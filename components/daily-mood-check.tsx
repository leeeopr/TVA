'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDailyMood, DailyMoodType, MoodDefinition } from '@/hooks/useDailyMood';
import { useProductivityStore } from '@/stores/productivityStore';
import { sounds } from '@/lib/sounds';
import { Terminal, ShieldAlert, Check, RefreshCw } from 'lucide-react';

export default function DailyMoodCheck() {
  const { status, shuffledEmotions, saveMood, errorMsg, checkTodayMood } = useDailyMood();
  const { settings } = useProductivityStore();
  
  const [booting, setBooting] = useState(true);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [showQuestion, setShowQuestion] = useState(false);
  const [selectedKey, setSelectedKey] = useState<DailyMoodType | null>(null);
  const [completedAnimation, setCompletedAnimation] = useState(false);

  // Sound cues and typing effects on boot when unanswered
  useEffect(() => {
    if (status !== 'unanswered') {
      if (status === 'already_answered') {
        const timer = setTimeout(() => {
          setBooting(false);
          setShowQuestion(false);
        }, 0);
        return () => clearTimeout(timer);
      }
      return;
    }

    const timer = setTimeout(() => {
      setBooting(true);
      setShowQuestion(false);
      setCompletedAnimation(false);
      setBootLines([]);
    }, 0);

    const lines = [
      'RETRO_OS COGNITIVE DIAGNOSTIC UNIT [ONLINE]',
      'UPLINK: SYNCHRONIZING REALTIME EMOTION LAYER...',
      'DIAGNOSTIC: READING PHYSIOLOGICAL INDEX VIBRATION... OK',
      'USER STATUS: ACTIVE NEURAL CONNECTION ESTABLISHED',
      'INITIATING DAILY INTROSPETION DIAGNOSTIC PROTOCOL...',
      '------------------------------------------------',
      'NOTICE: COGNITION REGISTER REQUIRED TO PROCEED',
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
      }, 250);
    }, 50);

    return () => {
      clearTimeout(timer);
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
    };
  }, [status]);

  // If already answered, do not render modal
  if (status === 'already_answered' && !completedAnimation) {
    return null;
  }

  // Fallback to avoid rendering modal if loading at early startup
  if (status === 'loading' && booting) {
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

  const handleSelectEmotion = async (emo: MoodDefinition) => {
    if (status === 'saving' || selectedKey) return;
    setSelectedKey(emo.key);
    sounds.playButtonSwitch();
    
    // Slight delay to enrich visual tactile feedback
    setTimeout(async () => {
      const success = await saveMood(emo.key, emo.labelZh);
      if (success) {
        sounds.playAlarmFocusComplete();
        setCompletedAnimation(true);
      } else {
        setSelectedKey(null);
      }
    }, 600);
  };

  return (
    <AnimatePresence>
      {((status !== 'already_answered') || (selectedKey && !completedAnimation)) && (
        <motion.div
          id="daily-mood-fullscreen-panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          style={{ '--color-amber': activeColor, '--color-amber-glow': glowColor } as React.CSSProperties}
          className="fixed inset-0 z-[10000] bg-[#040302] p-6 font-mono crt-container flex flex-col items-center justify-center select-none overflow-y-auto"
        >
          {/* Retro CRT Overlays */}
          <div className={scanlineClass} />
          <div className="crt-vignette pointer-events-none" />
          <div className="phosphor-beam pointer-events-none" />

          {/* Container console board */}
          <div 
            className="w-full max-w-4xl flex flex-col justify-between min-h-[85vh] md:min-h-[75vh] border-2 p-6 md:p-10 rounded-2xl bg-[#090706] relative z-10 transition-colors duration-500 overflow-hidden"
            style={{ borderColor: activeColor, boxShadow: `0 0 35px ${glowColor}` }}
          >
            
            {/* Header branding info */}
            <div className="absolute top-3 left-4 text-[10px] tracking-widest opacity-60 flex items-center gap-1.5" style={{ color: activeColor }}>
              <Terminal className="w-3.5 h-3.5 animate-pulse" />
              <span>DIARY DIAGNOSTIC CONSOLE [CLOUD_SYNCED]</span>
            </div>
            <div className="absolute top-3 right-4 text-[10px] tracking-widest opacity-60" style={{ color: activeColor }}>
              <span>RETRO_OS v4.26_EMOTION</span>
            </div>

            {/* Boot step loading visual */}
            {(booting || status === 'loading') && (
              <div className="flex-1 flex flex-col justify-center items-start space-y-2 font-mono text-xs md:text-sm md:pl-6 leading-relaxed select-none">
                {bootLines.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ color: activeColor }}
                  >
                    {line && line.startsWith('NOTICE') ? (
                      <span className="flex items-center gap-1.5 text-yellow-500 font-bold tracking-widest">
                        <ShieldAlert className="w-4 h-4 animate-bounce" />
                        {line}
                      </span>
                    ) : (
                      <span>{`> ${line}`}</span>
                    )}
                  </motion.div>
                ))}
                
                {status === 'loading' && (
                  <div className="flex items-center gap-2 text-xs opacity-50 mt-4" style={{ color: activeColor }}>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>CONSULTING CLOUD MEMORY SECTORS...</span>
                  </div>
                )}

                <motion.span 
                  animate={{ opacity: [1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-2 h-4 pl-1 inline-block"
                  style={{ backgroundColor: activeColor }}
                />
              </div>
            )}

            {/* Main Selection Area */}
            {showQuestion && status !== 'loading' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex-1 flex flex-col justify-center my-6 space-y-10 w-full"
              >
                {/* Traditional Chinese text prompt and subtitle */}
                <div className="text-center space-y-4">
                  <motion.h2 
                    className="text-4xl md:text-6xl font-black tracking-widest text-[#ffffff] font-extrabold select-none"
                    style={{ textShadow: `0 0 15px ${activeColor}` }}
                  >
                    你今天感覺如何？
                  </motion.h2>
                  <p className="text-xs tracking-[0.3em] font-medium" style={{ color: activeColor }}>
                    HOW ARE YOU FEELING TODAY? // SHUFFLED DAILY FOR BIAS ELIMINATION
                  </p>
                </div>

                {/* Shuffled options grid */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mt-8 max-w-4xl mx-auto w-full">
                  {shuffledEmotions.map((emo) => {
                    const isSelected = selectedKey === emo.key;
                    const isAnySelected = selectedKey !== null;

                    return (
                      <motion.button
                        key={emo.key}
                        onClick={() => handleSelectEmotion(emo)}
                        disabled={isAnySelected || status === 'saving'}
                        whileHover={!isAnySelected ? { scale: 1.04, y: -2 } : {}}
                        whileTap={!isAnySelected ? { scale: 0.98 } : {}}
                        className={`aspect-square p-4 border-2 rounded-xl flex flex-col justify-center items-center gap-3 bg-transparent cursor-pointer transition-all duration-300 relative overflow-hidden select-none ${outlineStyle} ${hoverBg}`}
                        style={{
                          borderColor: isSelected ? activeColor : undefined,
                          backgroundColor: isSelected ? `${activeColor}15` : undefined,
                          opacity: isAnySelected && !isSelected ? 0.35 : 1,
                        }}
                      >
                        {/* Selected overlay tick markup */}
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

                        {/* Large Chinese character display */}
                        <span className="text-2xl md:text-3xl font-black select-none tracking-widest text-[#ffffff]">
                          {emo.labelZh}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Loading / Saving spinner feedback */}
                {status === 'saving' && (
                  <div className="flex justify-center items-center gap-2 text-xs uppercase animate-pulse" style={{ color: activeColor }}>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>SYNCING DIARY LOG TO RETRO_CLOUD DATABASE CORES...</span>
                  </div>
                )}

                {/* Error Banner inside modal with skip option to avoid softlock if SQL has issues */}
                {status === 'error' && (
                  <div className="border border-red-500/40 bg-red-950/20 p-4 rounded-lg max-w-2xl mx-auto text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 text-red-500 text-xs font-bold uppercase tracking-widest">
                      <ShieldAlert className="w-4 h-4 animate-bounce" />
                      <span>UPLOAD EXCEPTION OCCURRED</span>
                    </div>
                    <p className="text-[10px] text-red-300 font-mono tracking-wider">
                      {errorMsg}
                    </p>
                    <div className="flex gap-4 justify-center pt-2">
                      <button 
                        onClick={() => checkTodayMood()}
                        className="text-[10px] uppercase font-bold tracking-widest px-3 py-1.5 border border-red-500/50 hover:bg-red-500/10 rounded cursor-pointer transition-all"
                        style={{ color: activeColor }}
                      >
                        Retry Sync
                      </button>
                      <button 
                        onClick={() => {
                          sounds.playButtonSwitch();
                          setCompletedAnimation(true);
                        }}
                        className="text-[10px] uppercase font-bold tracking-widest px-3 py-1.5 border border-white/20 hover:bg-white/10 rounded cursor-pointer transition-all text-neutral-400"
                      >
                        Bypass (Verificação local)
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Bottom operational state footer */}
            <div 
              className="flex justify-between items-center border-t pt-4 text-[9px] tracking-wider font-semibold uppercase opacity-60"
              style={{ borderTopColor: `${activeColor}30`, color: activeColor }}
            >
              <span>UPLINK CODE: INTR-EMOT-998</span>
              <span>100% PERSISTED ON CLOUD // ZERO LOCAL CACHE STORAGE</span>
              <span>BUFFER SECTOR: ENGAGED</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
