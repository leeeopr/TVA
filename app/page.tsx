'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Monitor } from 'lucide-react';
import { db } from '@/lib/db';
import { sounds } from '@/lib/sounds';
import { useAuthStore } from '@/stores/authStore';

export default function HomeBootPage() {
  const router = useRouter();
  const { user, initialize } = useAuthStore();

  const [bootProgress, setBootProgress] = useState(0);
  const [bootMessage, setBootMessage] = useState('INIT SYSTEM RETRO_OS v4.02...');

  // Initialize auth sub
  useEffect(() => {
    const unsub = initialize();
    return () => unsub();
  }, [initialize]);

  // Boot progress loop
  useEffect(() => {
    let progress = 0;
    const bootSteps = [
      { p: 10, text: 'LOADING CATHODE RECEPTACLE DRIVERS...' },
      { p: 25, text: 'DIAGNOSTICS: MEMORY BUFFER SECTOR 0xFF99... OK' },
      { p: 40, text: 'UPLINK STATUS: ESTABLISHING SECURE HANDSHAKE...' },
      { p: 55, text: 'RETRIEVING DATA ARRAYS FROM LOCAL DATABASE...' },
      { p: 70, text: 'SYNCING CHRONOS TIME ENGINE QUANTUM CHIPS...' },
      { p: 85, text: 'APPLYING CRT ORBITAL ELECTRON SWEETS...' },
      { p: 98, text: 'SUCCESS. TERMINAL ON-LINE.' }
    ];

    db.addLog('SYSTEM INITIALIZATION DECK G-49 STARTED.', 'system');

    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 8) + 4;
      if (progress >= 100) {
        progress = 100;
        setBootProgress(100);
        setBootMessage('COMPLETED. SECURING HANDSHAKE...');
        clearInterval(interval);
        
        sounds.playSystemBoot();
        db.addLog('WELCOME, OPERATOR. SYSTEM DIAGNOSTIC STATUS OK.', 'success');

        setTimeout(() => {
          // Route redirection on success
          db.initAuth();
          if (user) {
            router.push('/dashboard');
          } else {
            router.push('/login');
          }
        }, 800);
      } else {
        setBootProgress(progress);
        const match = bootSteps.find(b => progress <= b.p);
        if (match) setBootMessage(match.text);
      }
    }, 90);

    return () => clearInterval(interval);
  }, [router, user]);

  return (
    <div className="min-h-screen bg-[#040302] selection:bg-[#ffb347] selection:text-black p-4 font-mono crt-container flex items-center justify-center">
      {/* Scanline layer overlays */}
      <div className="crt-scanlines" />
      <div className="crt-vignette" />
      <div className="phosphor-beam" />

      {/* BOOT LOADING CARD CONTAINER */}
      <div className="w-full max-w-xl border-2 p-6 md:p-8 rounded-xl border-[#ffb347] bg-[#0d0b09] amber-glow-border relative z-10 text-center">
        <div className="absolute top-2.5 left-4 text-[10px] tracking-widest text-[#ffb347] font-bold">
          [ SECURE BIOS CONTROL BOOT ]
        </div>
        <div className="absolute top-2.5 right-4 flex items-center gap-1.5 font-bold">
          <div className="w-2 h-2 rounded-full bg-[#ffb347] animate-ping" />
          <span className="text-[10px] text-[#ffb347]">SYSTEM BOOT</span>
        </div>

        <div className="my-10 space-y-4">
          <div className="text-xl md:text-2xl font-black text-[#ffb347] tracking-widest flex items-center justify-center gap-2">
            <Monitor className="w-6 h-6 animate-pulse" />
            RETRO_OS PROCESSOR v4.02
          </div>
          
          <p className="text-xs text-[#ffb347] tracking-widest font-mono h-12 flex items-center justify-center uppercase">
            {bootMessage}
          </p>

          {/* Simulated BIOS Loading Bar */}
          <div className="w-full h-4 border border-[#ffb347] p-0.5 mt-4">
            <div 
              className="h-full bg-[#ffb347] transition-all duration-75"
              style={{ width: `${bootProgress}%` }}
            />
          </div>
        </div>

        <div className="text-[11px] text-[#ffb347] opacity-65 flex justify-between items-center mt-6 border-t pt-4 border-[#ffb347]/30">
          <span>PORT: 3000 // CORE MODE</span>
          <span>TVA OPERATOR MATRIX PROT-402</span>
        </div>
      </div>
    </div>
  );
}
