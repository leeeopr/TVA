'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { sounds } from '@/lib/sounds';
import { db } from '@/lib/db';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    sounds.playButtonSwitch();
    setLoading(true);
    setErrorMsg('');
    setTerminalLogs([]);

    // Step-by-step terminal loading simulation
    const steps = [
      'DISPATCHING HANDSHAKE REQUEST...',
      'ESTABLISHING SECURE PORT MATRIX...',
      'AUTHORIZING OPERATOR CREDENTIALS...',
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 350));
      setTerminalLogs(prev => [...prev, steps[i]]);
      sounds.playKeyClick();
    }

    const { error } = await signIn(email, password);

    if (error) {
      setTerminalLogs(prev => [...prev, 'CRITICAL CORRUPTION: ACCESS DENIED.']);
      setErrorMsg(error.message || 'Falha na autenticação. Verifique suas credenciais.');
      sounds.playAlarmBreak();
      setLoading(false);
    } else {
      setTerminalLogs(prev => [...prev, 'SESSION INITIALIZED.', 'ACCESS GRANTED.']);
      sounds.playAlarmFocusComplete();
      db.addLog(`OPERATOR SECURE CONNECTION ESTABLISHED FOR: [${email}]`, 'success');

      // Final short delay for maximum aesthetics
      setTimeout(() => {
        router.push('/dashboard');
      }, 600);
    }
  };

  return (
    <div className="space-y-6 pt-4 text-left">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-black tracking-widest text-[var(--color-amber)] select-none">
          OPERATOR_SIGNIN
        </h2>
        <p className="text-[10px] text-[var(--color-amber)] opacity-70 uppercase tracking-widest">
          Insira chave de email e senha criptografada
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xxs uppercase tracking-wider text-[var(--color-amber)] opacity-80 block font-bold">Endereço de Chave (Email)</label>
          <input
            type="email"
            required
            disabled={loading}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ex: operador@tva.gov"
            className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-2 text-xs text-[var(--color-amber)] focus:outline-none rounded font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xxs uppercase tracking-wider text-[var(--color-amber)] opacity-80 block font-bold">Código Identificador (Senha)</label>
          <input
            type="password"
            required
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••••"
            className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-2 text-xs text-[var(--color-amber)] focus:outline-none rounded font-mono"
          />
        </div>

        {errorMsg && (
          <div className="border border-rose-800 bg-rose-950/20 p-2.5 rounded text-xxs text-rose-400 font-bold uppercase tracking-wide leading-relaxed animate-pulse">
            [ERRO]: {errorMsg}
          </div>
        )}

        {/* Real-time Loading Steps Terminal */}
        {terminalLogs.length > 0 && (
          <div className="p-3 border border-[var(--color-amber)]/20 bg-[#0d0b09]/90 rounded-lg text-left text-[9px] space-y-1 font-mono text-[var(--color-amber)] leading-none select-none max-h-[100px] overflow-y-auto">
            {terminalLogs.map((log, idx) => (
              <div key={idx} className="flex gap-1.5 items-start">
                <span className="opacity-55">&gt;</span>
                <span className={log.includes('ACCESS GRANTED') || log.includes('SESSION INITIALIZED') ? 'text-emerald-400 font-extrabold' : log.includes('DENIED') ? 'text-rose-400' : ''}>
                  {log}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          onClick={() => sounds.playButtonSwitch()}
          className="w-full py-2 border bg-[var(--color-amber)] text-black font-black text-xs hover:bg-[#ffd19a] uppercase rounded flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45"
        >
          {loading ? 'AUTORIZANDO...' : 'REQUISITAR ENTRADA'}
        </button>
      </form>

      {/* QUICK FOOTER HELPER LINKS */}
      <div className="border-t border-[var(--color-amber)]/20 pt-4 flex flex-col sm:flex-row justify-between text-xxs text-[var(--color-amber)]/75 uppercase font-bold tracking-wider text-center sm:text-left gap-2 sm:gap-0">
        <Link 
          href="/register" 
          onClick={() => sounds.playKeyClick()}
          className="hover:underline hover:text-[var(--color-amber)] cursor-pointer"
        >
          Criar Registro Operador
        </Link>
        <Link 
          href="/forgot-password" 
          onClick={() => sounds.playKeyClick()}
          className="hover:underline hover:text-[var(--color-amber)] cursor-pointer"
        >
          Recuperar Identificador
        </Link>
      </div>
    </div>
  );
}
