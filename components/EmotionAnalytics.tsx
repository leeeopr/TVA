'use client';

import React, { useEffect } from 'react';
import { useEmotionStore, EmotionType, EMOTIONS } from '@/stores/emotionStore';
import { useProductivityStore } from '@/stores/productivityStore';
import EmotionHeatmap from './EmotionHeatmap';
import EmotionTimeline from './EmotionTimeline';
import { BrainCircuit, Activity, Flame, TrendingUp } from 'lucide-react';

export default function EmotionAnalytics() {
  const { emotionHistory, fetchHistory } = useEmotionStore();
  const { settings } = useProductivityStore();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const activeColor = 
    settings.theme_mode === 'AMBER' 
      ? '#ffb347' 
      : settings.theme_mode === 'GREEN' 
        ? '#33ff33' 
        : '#00e5ff';

  const glowColor = 
    settings.theme_mode === 'AMBER' 
      ? 'rgba(255, 179, 71, 0.45)' 
      : settings.theme_mode === 'GREEN' 
        ? 'rgba(51, 255, 51, 0.45)' 
        : 'rgba(0, 229, 255, 0.45)';

  // Assign scores to emotion keys (1-5)
  const emotionScores: Record<EmotionType, number> = {
    sad: 1,
    overthinking: 2,
    zen: 3,
    happy: 4,
    agitated: 5,
  };

  // 1. Dominant Emotion
  const getDominantEmotion = (): { zh: string; key: string } => {
    if (emotionHistory.length === 0) return { zh: '無數據', key: 'none' };
    const counts: Record<string, number> = {};
    emotionHistory.forEach((log) => {
      counts[log.emotion_type] = (counts[log.emotion_type] || 0) + 1;
    });

    let maxKey = '';
    let maxVal = 0;
    Object.entries(counts).forEach(([k, v]) => {
      if (v > maxVal) {
        maxKey = k;
        maxVal = v;
      }
    });

    const displayZh = EMOTIONS.find((e) => e.key === maxKey)?.labelZh || '尋常';
    return { zh: displayZh, key: maxKey };
  };

  // 2. Emotional Stability Coefficient
  const getStabilityCoefficient = (): number => {
    if (emotionHistory.length < 2) return 100;

    // Ordered chronologically for calculation
    const chronoLogs = [...emotionHistory]
      .sort((a, b) => new Date(a.local_date).getTime() - new Date(b.local_date).getTime());

    let deltaSum = 0;
    for (let i = 1; i < chronoLogs.length; i++) {
      const parentScore = emotionScores[chronoLogs[i - 1].emotion_type] || 3;
      const childScore = emotionScores[chronoLogs[i].emotion_type] || 3;
      deltaSum += Math.abs(childScore - parentScore);
    }

    const avgDelta = deltaSum / (chronoLogs.length - 1);
    // Stability calculation: perfect (0 diff) is 100%, max average difference of 4
    const stability = Math.max(10, Math.min(100, Math.round(100 - (avgDelta * 22))));
    return stability;
  };

  // 3. Consecutive Zen/Calm Days Streak
  const getZenStreak = (): number => {
    if (emotionHistory.length === 0) return 0;

    // Map logs, keyed by date string
    const logByDate = new Map<string, typeof emotionHistory[0]>(
      emotionHistory.map((l) => [l.local_date, l])
    );
    
    let streak = 0;
    const checkDate = new Date();
    
    const getFormatted = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = getFormatted(checkDate);

    // Check if yesterday or today was logged to start counting
    const hasLogToday = logByDate.has(todayStr);
    
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = getFormatted(checkDate);
    const hasLogYesterday = logByDate.has(yesterdayStr);

    if (!hasLogToday && !hasLogYesterday) {
      return 0;
    }

    const startCheckingDate = new Date();
    if (!hasLogToday && hasLogYesterday) {
      // Start checking backwards from yesterday
      startCheckingDate.setDate(startCheckingDate.getDate() - 1);
    }

    // Traverse backward to read positive states
    for (let i = 0; i < 365; i++) {
      const dateKey = getFormatted(startCheckingDate);
      const log = logByDate.get(dateKey);

      if (log && ['zen', 'happy'].includes(log.emotion_type)) {
        streak++;
        startCheckingDate.setDate(startCheckingDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  // 4. Emotional Trend Direction
  const getVibrationTrend = (): string => {
    if (emotionHistory.length < 3) return '恆定波形 (BALANCED PHASE)';

    const scores = emotionHistory.map((l) => emotionScores[l.emotion_type] || 3);
    const mid = Math.ceil(scores.length / 2);
    
    const recentScores = scores.slice(0, mid);
    const priorScores = scores.slice(mid);

    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    const priorAvg = priorScores.reduce((a, b) => a + b, 0) / priorScores.length;

    if (recentAvg > priorAvg + 0.25) {
      return '蓄能上揚 (RISING COGNITIVE WAVE)';
    } else if (recentAvg < priorAvg - 0.25) {
      return '沉斂下潜 (DECREASING CONVERGENCE)';
    } else {
      return '穩固共振 (HARMONIC PLENUM)';
    }
  };

  const dominant = getDominantEmotion();
  const stability = getStabilityCoefficient();
  const streak = getZenStreak();
  const trend = getVibrationTrend();

  return (
    <div className="space-y-6 select-none font-mono">
      
      {/* 1. TOP METRICS CORES Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Dominant state display */}
        <div 
          className="border border-[var(--color-amber)]/20 p-5 rounded-xl bg-[#090706] relative overflow-hidden flex flex-col justify-between h-40"
          style={{ boxShadow: `inset 0 0 10px ${glowColor}10` }}
        >
          <div className="absolute top-2 right-2 text-[var(--color-amber)] opacity-25">
            <BrainCircuit className="w-8 h-8 animate-pulse" />
          </div>
          <span className="text-[10px] text-[var(--color-amber)]/50 tracking-wider uppercase font-bold">
            優勢心理狀態 (DOMINANT ARCHETYPE)
          </span>
          <div className="my-2 flex items-baseline gap-3">
            <span 
              className="text-5xl font-black text-white"
              style={{ textShadow: `0 0 10px ${activeColor}` }}
            >
              {dominant.zh}
            </span>
            <span className="text-[10px] border border-[var(--color-amber)]/20 px-1 py-0.5 rounded text-[var(--color-amber)]/60 uppercase">
              {dominant.key === 'none' ? 'N/A' : dominant.key}
            </span>
          </div>
          <p className="text-[9px] text-[var(--color-amber)]/60 leading-normal uppercase">
            Predominant resonant energy field within operational memory logs.
          </p>
        </div>

        {/* Stability Index */}
        <div 
          className="border border-[var(--color-amber)]/20 p-5 rounded-xl bg-[#090706] relative overflow-hidden flex flex-col justify-between h-40"
          style={{ boxShadow: `inset 0 0 10px ${glowColor}10` }}
        >
          <div className="absolute top-2 right-2 text-[var(--color-amber)] opacity-25">
            <Activity className="w-8 h-8" />
          </div>
          <span className="text-[10px] text-[var(--color-amber)]/50 tracking-wider uppercase font-bold">
            心理波形穩定率 (STABILITY INDEX)
          </span>
          <div className="my-2 flex items-baseline gap-2">
            <span 
              className="text-5xl font-black text-white"
              style={{ textShadow: `0 0 10px ${activeColor}` }}
            >
              {stability}%
            </span>
            <span className="text-[10px] text-[var(--color-amber)] opacity-60">COEFF</span>
          </div>
          {/* Animated retro stability progression bar */}
          <div className="w-full h-1.5 bg-[var(--color-amber)]/10 rounded-full overflow-hidden mt-1">
            <div 
              className="h-full bg-[var(--color-amber)] transition-all duration-1000"
              style={{ 
                width: `${stability}%`,
                backgroundColor: activeColor,
                boxShadow: `0 0 8px ${activeColor}`
              }}
            />
          </div>
          <p className="text-[9px] text-[var(--color-amber)]/60 leading-normal uppercase">
            Consistency level between sequential psychological state measurements.
          </p>
        </div>

        {/* Zen/Calm streak day counter */}
        <div 
          className="border border-[var(--color-amber)]/20 p-5 rounded-xl bg-[#090706] relative overflow-hidden flex flex-col justify-between h-40"
          style={{ boxShadow: `inset 0 0 10px ${glowColor}10` }}
        >
          <div className="absolute top-2 right-2 text-[var(--color-amber)] opacity-25">
            <Flame className="w-8 h-8 animate-pulse text-orange-500" />
          </div>
          <span className="text-[10px] text-[var(--color-amber)]/50 tracking-wider uppercase font-bold">
            連續澄靜週期 (ZEN STREAK STAGE)
          </span>
          <div className="my-2 flex items-baseline gap-2">
            <span 
              className="text-5xl font-black text-white"
              style={{ textShadow: `0 0 10px ${activeColor}` }}
            >
              {streak}
            </span>
            <span className="text-[10px] text-[var(--color-amber)] opacity-60">CYCLES</span>
          </div>
          <p className="text-[9px] text-[var(--color-amber)]/60 leading-normal uppercase">
            Consecutive daily recordings maintaining zen or happy states.
          </p>
        </div>

        {/* Vibration trend */}
        <div 
          className="border border-[var(--color-amber)]/20 p-5 rounded-xl bg-[#090706] relative overflow-hidden flex flex-col justify-between h-40"
          style={{ boxShadow: `inset 0 0 10px ${glowColor}10` }}
        >
          <div className="absolute top-2 right-2 text-[var(--color-amber)] opacity-25">
            <TrendingUp className="w-8 h-8" />
          </div>
          <span className="text-[10px] text-[var(--color-amber)]/50 tracking-wider uppercase font-bold">
            振盪能量走勢 (VIBRATIONAL TREND)
          </span>
          <div className="my-2 select-none">
            <p className="text-sm font-black whitespace-normal break-words text-white uppercase tracking-widest leading-tight">
              {trend}
            </p>
          </div>
          <p className="text-[9px] text-[var(--color-amber)]/60 leading-normal uppercase">
            Long-term emotional direction analyzed via sliding core divisions.
          </p>
        </div>

      </div>

      {/* 2. CHOSEN CHANGER SUB-COMPONENTS PLENUM G-9 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        
        {/* Heatmap takes up 3 columns */}
        <div className="lg:col-span-3 flex">
          <EmotionHeatmap logs={emotionHistory} />
        </div>

        {/* Timeline sequential view takes up 2 columns */}
        <div className="lg:col-span-2 flex">
          <EmotionTimeline logs={emotionHistory} />
        </div>

      </div>

    </div>
  );
}
