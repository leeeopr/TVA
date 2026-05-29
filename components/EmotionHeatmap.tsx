'use client';

import React from 'react';
import { EmotionLog, EmotionType, EMOTIONS } from '@/stores/emotionStore';
import { useProductivityStore } from '@/stores/productivityStore';

interface EmotionHeatmapProps {
  logs: EmotionLog[];
}

export default function EmotionHeatmap({ logs }: EmotionHeatmapProps) {
  const { settings } = useProductivityStore();

  const activeColor = 
    settings.theme_mode === 'AMBER' 
      ? '#ffb347' 
      : settings.theme_mode === 'GREEN' 
        ? '#33ff33' 
        : '#00e5ff';

  // Generate last 12 weeks (84 days) grid
  const daysInGrid = 84;
  const gridCells = Array.from({ length: daysInGrid }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (daysInGrid - 1 - i));
    
    // Format to yyyy-mm-dd local ISO-like date string
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const matchingLog = logs.find((l) => l.local_date === dateStr);
    return {
      date: d,
      dateString: dateStr,
      log: matchingLog,
    };
  });

  // Helper mapping emotion key to a single Traditional Chinese symbol for mini preview
  const getEmotionGlyph = (key: EmotionType): string => {
    switch (key) {
      case 'agitated': return '焦';
      case 'happy': return '開';
      case 'sad': return '悲';
      case 'zen': return '平';
      case 'overthinking': return '內';
      default: return '·';
    }
  };

  // Helper returning opacity weight based on emotional vibration level
  const getIntensityClass = (key: EmotionType): string => {
    switch (key) {
      case 'sad': return 'opacity-30 bg-[var(--color-amber)]';
      case 'overthinking': return 'opacity-50 bg-[var(--color-amber)]';
      case 'zen': return 'opacity-70 bg-[var(--color-amber)] shadow-[0_0_8px_var(--color-amber-glow)]';
      case 'happy': return 'opacity-85 bg-[var(--color-amber)] shadow-[0_0_12px_var(--color-amber-glow)]';
      case 'agitated': return 'opacity-100 bg-[var(--color-amber)] shadow-[0_0_15px_var(--color-amber-glow)]';
      default: return 'bg-transparent border border-[var(--color-amber)]/20';
    }
  };

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const rows: { weekday: string; cells: typeof gridCells }[] = Array.from({ length: 7 }).map((_, wIndex) => {
    const filteredCells = gridCells.filter((c) => c.date.getDay() === wIndex);
    return {
      weekday: weekdays[wIndex],
      cells: filteredCells,
    };
  });

  return (
    <div className="border border-[var(--color-amber)]/30 rounded-xl p-5 bg-[#14100c]/30 backdrop-blur-sm self-stretch flex flex-col gap-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-1 px-2.5 text-[8px] bg-[var(--color-amber)]/10 text-[var(--color-amber)] font-bold rounded-bl-lg tracking-widest border-l border-b border-[var(--color-amber)]/20">
        GRID DATA CORES: 12W EXP
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-bold tracking-widest text-[var(--color-amber)] flex items-center gap-2">
          <span>●</span> 情感矩陣分佈熱圖 (EMOTIONAL DISPOSITION WAVEGRID)
        </h3>
        <p className="text-[10px] text-[var(--color-amber)]/60 uppercase tracking-wider">
          Longitudinal matrix grid of trailing 84 status cycles.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto py-2 pr-2 select-none justify-center lg:justify-start">
        {/* Row Weekday headers */}
        <div className="flex flex-col justify-between text-[11px] text-[var(--color-amber)]/40 font-bold pr-2 text-center pt-5 h-[166px]">
          {weekdays.map((day, idx) => (
            <span key={idx} className="h-4 flex items-center justify-center">{day}</span>
          ))}
        </div>

        {/* Matrix grid cells container */}
        <div className="flex flex-col gap-1.5 h-[166px]">
          {rows.map((row, rIdx) => (
            <div key={rIdx} className="flex gap-1.5 items-center">
              {row.cells.map((cell, cIdx) => {
                const log = cell.log;
                const tooltipText = log 
                  ? `${cell.dateString} : [${log.emotion_label_zh}] (${log.emotion_type})`
                  : `${cell.dateString} : [無紀錄]`;

                return (
                  <div
                    key={cIdx}
                    className="relative group cursor-crosshair"
                  >
                    <div
                      className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-black transition-all duration-300 ${
                        log ? getIntensityClass(log.emotion_type) : 'border border-[var(--color-amber)]/10 text-[var(--color-amber)]/10 bg-transparent hover:border-[var(--color-amber)]/40 hover:text-[var(--color-amber)]/30'
                      }`}
                      style={{
                        color: log ? '#000000' : undefined,
                        fontWeight: '900',
                      }}
                    >
                      {log ? getEmotionGlyph(log.emotion_type) : '·'}
                    </div>

                    {/* Popover Hover tooltip */}
                    <div className="opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 p-2 bg-[#090706] border border-[var(--color-amber)] rounded text-[9px] tracking-widest text-[var(--color-amber)] whitespace-nowrap z-50 shadow-md">
                      {tooltipText}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend guide */}
      <div className="border-t border-[var(--color-amber)]/10 pt-3 flex justify-between items-center text-[10px] text-[var(--color-amber)]/60">
        <span className="tracking-widest">輕度波瀾 ──→ 強盛</span>
        <div className="flex items-center gap-2">
          {EMOTIONS.map((emo) => (
            <div key={emo.key} className="flex items-center gap-1">
              <span 
                className={`w-2 h-2 rounded ${getIntensityClass(emo.key)}`}
                style={{ opacity: 1, backgroundColor: activeColor }}
              />
              <span className="text-[9px]">{emo.labelZh}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
