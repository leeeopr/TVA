'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';

export type EmotionType =
  | 'agitated'
  | 'happy'
  | 'sad'
  | 'zen'
  | 'overthinking';

export interface EmotionDefinition {
  key: EmotionType;
  labelZh: string;
  pinyin: string;
}

export const EMOTIONS: EmotionDefinition[] = [
  { key: 'agitated', labelZh: '焦躁', pinyin: 'jiāo zào' }, // ACELERADO / AGITATED
  { key: 'happy', labelZh: '開心', pinyin: 'kāi xīn' },          // FELIZ / HAPPY
  { key: 'sad', labelZh: '難過', pinyin: 'nán guò' },           // TRISTE / SAD
  { key: 'zen', labelZh: '平靜', pinyin: 'píng jìng' },          // ZEN / CALM
  { key: 'overthinking', labelZh: '消極思考', pinyin: 'xiāo jí sī kǎo' }, // PENSATIVO RUIM / OVERTHINKING
];

// Seeded deterministic random generator for shuffling options daily without muscle memory
export function getDeterministicRandom(seedStr: string) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = (h << 5) - h + seedStr.charCodeAt(i);
    h |= 0;
  }
  return function () {
    h = (h * 1664525 + 1013904223) | 0;
    return (h >>> 0) / 4294967296;
  };
}

export function shuffleDeterministic<T>(array: T[], seedStr: string): T[] {
  const nextRand = getDeterministicRandom(seedStr);
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface EmotionLog {
  id: string;
  user_id: string;
  emotion_type: EmotionType;
  emotion_label_zh: string;
  local_date: string;
  created_at: string;
}

interface EmotionState {
  todayEmotion: EmotionLog | null;
  hasAnsweredToday: boolean;
  emotionHistory: EmotionLog[];
  loading: boolean;
  shuffledEmotions: EmotionDefinition[];
  fetchHistory: () => Promise<void>;
  logTodayEmotion: (key: EmotionType) => Promise<boolean>;
}

export const useEmotionStore = create<EmotionState>((set, get) => ({
  todayEmotion: null,
  hasAnsweredToday: false,
  emotionHistory: [],
  loading: false,
  shuffledEmotions: EMOTIONS,

  fetchHistory: async () => {
    const userId = db.getUserId();
    const todayStr = getLocalDateString();

    // Compute deterministic daily shuffled options
    const shuffled = shuffleDeterministic(EMOTIONS, todayStr);
    set({ shuffledEmotions: shuffled });

    if (userId === 'user-default') {
      const logs = get().emotionHistory;
      const todayLog = logs.find((log) => log.local_date === todayStr) || null;
      set({
        todayEmotion: todayLog,
        hasAnsweredToday: !!todayLog,
        loading: false,
      });
      return;
    }

    set({ loading: true });
    try {
      db.addLog('REQ: READ EMOTIONAL LOG METRIC CORES', 'system');
      
      const { data, error } = await supabase
        .from('daily_emotion_logs')
        .select('*')
        .eq('user_id', userId)
        .order('local_date', { ascending: false });

      if (error) {
        throw error;
      }

      const logs: EmotionLog[] = data || [];
      const todayLog = logs.find((log) => log.local_date === todayStr) || null;

      set({
        emotionHistory: logs,
        todayEmotion: todayLog,
        hasAnsweredToday: !!todayLog,
        loading: false,
      });
    } catch (err: any) {
      db.addLog(`EMOTION_READ_ERR: ${err.message || err}`, 'error');
      const logs = get().emotionHistory;
      const todayLog = logs.find((log) => log.local_date === todayStr) || null;
      set({
        todayEmotion: todayLog,
        hasAnsweredToday: !!todayLog,
        loading: false,
      });
    }
  },

  logTodayEmotion: async (key: EmotionType) => {
    const userId = db.getUserId();
    const todayStr = getLocalDateString();
    const definition = EMOTIONS.find((e) => e.key === key);
    if (!definition) return false;

    const newLog: EmotionLog = {
      id: Math.random().toString(), // Will be overwritten by Supabase UUID
      user_id: userId,
      emotion_type: key,
      emotion_label_zh: definition.labelZh,
      local_date: todayStr,
      created_at: new Date().toISOString(),
    };

    set({ loading: true });
    
    // Optimistic state updates
    const currentHistory = [...get().emotionHistory];
    const filteredHistory = currentHistory.filter((log) => log.local_date !== todayStr);
    const updatedHistory = [newLog, ...filteredHistory];

    set({
      todayEmotion: newLog,
      hasAnsweredToday: true,
      emotionHistory: updatedHistory,
    });

    if (userId === 'user-default') {
      set({ loading: false });
      db.addLog(`EMOTION_LOG: RECORDED [${definition.labelZh}] ANONYMOUSLY`, 'success');
      return true;
    }

    try {
      db.addLog(`EMOTION_LOG: UPLINKING EMOTIONAL DISPOSITION [${key.toUpperCase()}]`, 'system');

      const { data, error } = await supabase
        .from('daily_emotion_logs')
        .upsert({
          user_id: userId,
          emotion_type: key,
          emotion_label_zh: definition.labelZh,
          local_date: todayStr,
        }, {
          onConflict: 'user_id, local_date'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        const cloudLog: EmotionLog = data;
        const freshHistory = [cloudLog, ...get().emotionHistory.filter((log) => log.local_date !== todayStr)];
        
        set({
          todayEmotion: cloudLog,
          emotionHistory: freshHistory,
        });
      }

      set({ loading: false });
      db.addLog(`EMOTION_LOG: REGISTRATION RECORDED -> [${definition.labelZh}]`, 'success');
      return true;
    } catch (err: any) {
      db.addLog(`EMOTION_WRITE_ERR: ${err.message || err}`, 'error');
      set({ loading: false });
      // Keep optimistic local state
      return true;
    }
  },
}));
