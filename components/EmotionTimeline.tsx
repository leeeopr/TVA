'use client';

import React from 'react';
import { EmotionLog } from '@/stores/emotionStore';
import { useProductivityStore } from '@/stores/productivityStore';
import { Calendar } from 'lucide-react';

interface EmotionTimelineProps {
  logs: EmotionLog[];
}

export default function EmotionTimeline({ logs }: EmotionTimelineProps) {
  const { settings } = useProductivityStore();

  const activeColor = 
    settings.theme_mode === 'AMBER' 
      ? '#ffb347' 
      : settings.theme_mode === 'GREEN' 
        ? '#33ff33' 
        : '#00e5ff';

  const getSubTitleText = (key: string): string => {
    switch (key) {
      case 'agitated': return 'RUSHED FLUX // 心理極焦';
      case 'happy': return 'OPTIMISTIC BEAM // 心生歡喜';
      case 'zen': return 'RESONANT PLENUM // 平穩定境';
      case 'sad': return 'DENSE COLD // 心感戚涼';
      case 'overthinking': return 'COGNITIVE DRAIN // 精神內耗';
      default: return 'UNKNOWN COMPLIANCE';
    }
  };

  const getEmotionWaveValue = (key: string): number => {
    switch (key) {
      case 'agitated': return 100;
      case 'happy': return 80;
      case 'zen': return 60;
      case 'overthinking': return 40;
      case 'sad': return 20;
      default: return 50;
    }
  };

  return (
    <div className="border border-[var(--color-amber)]/30 rounded-xl p-5 bg-[#14100c]/30 backdrop-blur-sm self-stretch flex flex-col gap-4 relative overflow-hidden w-full">
      <div className="absolute top-0 right-0 p-1 px-2.5 text-[8px] bg-[var(--color-amber)]/10 text-[var(--color-amber)] font-bold rounded-bl-lg tracking-widest border-l border-b border-[var(--color-amber)]/20">
        LOG CORES: CHRONOLOGY
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-bold tracking-widest text-[var(--color-amber)] flex items-center gap-2">
          <span>●</span> 歷史心理狀態序列 (CHRONOLOGICAL EMOTION DECK)
        </h3>
        <p className="text-[10px] text-[var(--color-amber)]/60 uppercase tracking-wider">
          Real-time diagnostic recordings of psychological entries indexed downwards.
        </p>
      </div>

      <div className="relative max-h-[300px] overflow-y-auto pr-3 space-y-4 font-mono select-none w-full">
        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--color-amber)]/30 tracking-widest uppercase border border-dashed border-[var(--color-amber)]/10 rounded w-full">
            [ No emotional tracks registered yet ]
          </div>
        ) : (
          <div className="relative border-l-2 border-[var(--color-amber)]/15 ml-3.5 space-y-5 py-2">
            {logs.map((log) => {
              const waveVal = getEmotionWaveValue(log.emotion_type);
              
              return (
                <div key={log.id} className="relative pl-6 group">
                  {/* Neon timeline nodes points */}
                  <div 
                    className="absolute -left-[7px] top-1.5 w-3.5 h-3.5 rounded-full border border-black z-10 transition-all duration-300"
                    style={{ 
                      backgroundColor: activeColor,
                      boxShadow: `0 0 10px ${activeColor}`,
                    }}
                  />

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-[var(--color-amber)]/[0.02] border border-[var(--color-amber)]/10 hover:border-[var(--color-amber)]/30 p-3.5 rounded-lg transition-all duration-200">
                    <div className="space-y-1">
                      {/* Emotion labels */}
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl font-bold text-white tracking-widest">
                          {log.emotion_label_zh}
                        </span>
                      </div>
                      <div className="text-[9px] font-bold text-[var(--color-amber)]/50 tracking-wider">
                        {getSubTitleText(log.emotion_type)}
                      </div>
                    </div>

                    {/* Timeline date and tracking mini waveforms */}
                    <div className="flex flex-col items-end gap-1.5 text-right w-full md:w-auto">
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-amber)]/60 font-semibold uppercase">
                        <Calendar className="w-3 h-3" />
                        <span>{log.local_date}</span>
                      </div>
                      
                      {/* Analog Wave indicator */}
                      <div className="w-24 h-1.5 bg-[var(--color-amber)]/10 rounded-full overflow-hidden flex items-center relative">
                        <div 
                          className="h-full bg-[var(--color-amber)] rounded-full transition-all duration-500" 
                          style={{ 
                            width: `${waveVal}%`,
                            boxShadow: `0 0 6px ${activeColor}`,
                            backgroundColor: activeColor
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
