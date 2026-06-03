'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { db } from '@/lib/db';

export type DailyMoodType = 'acelerado' | 'feliz' | 'triste' | 'zen' | 'pensativo_ruim';

export interface MoodDefinition {
  key: DailyMoodType;
  labelZh: string;
  pinyin: string;
}

export const MOODS: MoodDefinition[] = [
  { key: 'acelerado', labelZh: '焦躁', pinyin: 'jiāo zào' },
  { key: 'feliz', labelZh: '開心', pinyin: 'kāi xīn' },
  { key: 'triste', labelZh: '難過', pinyin: 'nán guò' },
  { key: 'zen', labelZh: '平靜', pinyin: 'píng jìng' },
  { key: 'pensativo_ruim', labelZh: '消極思考', pinyin: 'xiāo jí sī kǎo' },
];

/**
 * Seeded deterministic random generator for shuffling options daily.
 */
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

export interface MoodEntry {
  id: string;
  user_id: string;
  emotion: string;
  emotion_score: number;
  emotion_label_zh: string;
  created_at: string;
  mood_date: string;
}

export type DailyMoodStatus = 'loading' | 'unanswered' | 'already_answered' | 'saving' | 'success' | 'error';

export function useDailyMood() {
  const { user } = useAuthStore();
  const [status, setStatus] = useState<DailyMoodStatus>('loading');
  const [shuffledEmotions, setShuffledEmotions] = useState<MoodDefinition[]>(MOODS);
  const [emotionHistory, setEmotionHistory] = useState<MoodEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getTodayDateString = (): string => {
    // Return local date string YYYY-MM-DD
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const checkTodayMood = useCallback(async (uid: string) => {
    setStatus('loading');
    setErrorMsg(null);
    const today = getTodayDateString();
    
    // Deterministic shuffle
    const shuffled = shuffleDeterministic(MOODS, today);
    setShuffledEmotions(shuffled);

    try {
      db.addLog(`MOOD_SYSTEM: VERIFYING REGISTRATION STATUS FOR ${today}`, 'system');
      const { data, error } = await supabase
        .from('daily_moods')
        .select('id')
        .eq('user_id', uid)
        .eq('mood_date', today)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        db.addLog('MOOD_SYSTEM: USER HAS COMPLETED DIARY CHECK-IN TODAY.', 'success');
        setStatus('already_answered');
      } else {
        db.addLog('MOOD_SYSTEM: NO DIARY ENTRIES DETECTED TODAY. OPENING CONSOLE.', 'warning');
        setStatus('unanswered');
      }
    } catch (err: any) {
      // Print detailed error properties instead of generic error object
      console.error({
        message: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code
      });

      const readableError = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      setErrorMsg(`Erro ao buscar mood: ${readableError}`);
      setStatus('error');
    }
  }, []);

  const fetchHistory = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('daily_moods')
        .select('*')
        .eq('user_id', uid)
        .order('mood_date', { ascending: true });

      if (error) {
        throw error;
      }
      setEmotionHistory(data || []);
    } catch (err: any) {
      console.error({
        message: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code
      });
    }
  }, []);

  const saveMood = async (selectedMood: DailyMoodType, selectedLabel: string) => {
    if (!user) {
      setErrorMsg('Nenhum usuário autenticado encontrado.');
      setStatus('error');
      return false;
    }

    setStatus('saving');
    setErrorMsg(null);
    const today = getTodayDateString();

    const scoreMap: Record<DailyMoodType, number> = {
      zen: 5,
      feliz: 4,
      acelerado: 3,
      pensativo_ruim: 2,
      triste: 1
    };

    try {
      db.addLog(`MOOD_SYSTEM: PERSISTING EMOTIONAL DISPOSITION [${selectedMood.toUpperCase()}]`, 'system');
      const { error } = await supabase
        .from('daily_moods')
        .insert({
          user_id: user.id,
          emotion: selectedMood,
          emotion_score: scoreMap[selectedMood] || 3,
          emotion_label_zh: selectedLabel,
          mood_date: today
        });

      if (error) {
        throw error;
      }

      db.addLog(`MOOD_SYSTEM: ENTRY SAVED SECURELY ON CLOUD. STATUS: SUCCESS.`, 'success');
      setStatus('success');
      
      // Update history
      await fetchHistory(user.id);
      return true;
    } catch (err: any) {
      console.error({
        message: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code
      });
      
      const readableError = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      setErrorMsg(readableError);
      setStatus('error');
      db.addLog(`MOOD_SYSTEM_ERR: SAVE REJECTED: ${readableError}`, 'error');
      return false;
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (user) {
      timer = setTimeout(() => {
        checkTodayMood(user.id);
        fetchHistory(user.id);
      }, 0);
    } else {
      timer = setTimeout(() => {
        setStatus('loading');
      }, 0);
    }
    return () => clearTimeout(timer);
  }, [user, checkTodayMood, fetchHistory]);

  return {
    status,
    shuffledEmotions,
    emotionHistory,
    errorMsg,
    checkTodayMood: () => user && checkTodayMood(user.id),
    fetchHistory: () => user && fetchHistory(user.id),
    saveMood,
    setStatus
  };
}
