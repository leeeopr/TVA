'use client';

import React, { useEffect } from 'react';
import { Terminal } from 'lucide-react';
import { useProductivityStore } from '@/stores/productivityStore';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { settings, refreshData } = useProductivityStore();

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // CSS variables injector for theme custom values
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme_mode === 'AMBER') {
      root.style.setProperty('--color-amber', '#ffb347');
      root.style.setProperty('--color-amber-glow', 'rgba(255, 179, 71, 0.45)');
      root.style.setProperty('--color-amber-bg', '#0d0b09');
      root.style.setProperty('--color-amber-dark', '#331d05');
    } else if (settings.theme_mode === 'GREEN') {
      root.style.setProperty('--color-amber', '#33ff33');
      root.style.setProperty('--color-amber-glow', 'rgba(51, 255, 51, 0.45)');
      root.style.setProperty('--color-amber-bg', '#060e06');
      root.style.setProperty('--color-amber-dark', '#082c08');
    } else if (settings.theme_mode === 'COBALT') {
      root.style.setProperty('--color-amber', '#00e5ff');
      root.style.setProperty('--color-amber-glow', 'rgba(0, 229, 255, 0.45)');
      root.style.setProperty('--color-amber-bg', '#050b11');
      root.style.setProperty('--color-amber-dark', '#052c4c');
    }
  }, [settings.theme_mode]);

  // Styles helpers
  const borderStyle = settings.theme_mode === 'AMBER' 
    ? 'border-[#ffb347] amber-glow-border' 
    : settings.theme_mode === 'GREEN' 
      ? 'border-[#33ff33] green-glow-border'
      : 'border-[#00e5ff] cobalt-glow-border';

  const textStyle = settings.theme_mode === 'AMBER' 
    ? 'text-[#ffb347] amber-glow-text'
    : settings.theme_mode === 'GREEN'
      ? 'text-[#33ff33] green-glow-text'
      : 'text-[#00e5ff] cobalt-glow-text';

  const bgStyle = settings.theme_mode === 'AMBER'
    ? 'bg-[#0d0b09]'
    : settings.theme_mode === 'GREEN'
      ? 'bg-[#060e06]'
      : 'bg-[#050b11]';

  return (
    <div className={`min-h-screen ${bgStyle} selection:bg-[var(--color-amber)] selection:text-black flex items-center justify-center p-4 font-mono crt-container transition-colors duration-500`}>
      {/* Scanline layer overlays */}
      {settings.scanlines_enabled && <div className="crt-scanlines" />}
      <div className="crt-vignette" />
      <div className="phosphor-beam" />

      {/* Retro background tech gridding */}
      <div className={`absolute inset-0 opacity-40 pointer-events-none ${
        settings.theme_mode === 'AMBER' ? 'tech-grid-bg' : settings.theme_mode === 'GREEN' ? 'tech-grid-bg-green' : 'tech-grid-bg-cobalt'
      }`} />

      {/* Main Terminal Centered Shell */}
      <div className={`w-full max-w-md border-2 p-6 md:p-8 rounded-2xl relative z-10 text-center ${bgStyle} ${borderStyle}`}>
        <div className="absolute top-3 left-4 text-[10px] tracking-widest text-[var(--color-amber)] opacity-60 uppercase flex items-center gap-1.5 font-bold">
          <Terminal className="w-3.5 h-3.5" /> SECURE AUTH COGNITOR [GATE_V2]
        </div>

        <div className="mt-4">
          {children}
        </div>
      </div>
    </div>
  );
}
