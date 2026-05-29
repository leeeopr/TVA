'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { sendPasswordReset } from '@/lib/supabase/auth';
import { sounds } from '@/lib/sounds';
import { db } from '@/lib/db';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    sounds.playButtonSwitch();
    setErrorMsg('');
    setSuccessMsg('');
    setTerminalLogs([]);
    setLoading(true);

    const steps = [
      'RESOLVING HOST NAME MAPS...',
      'LOCATING EMAIL OPERATOR INDEX...',
      'COMPOSING TRANSFORMATION DECK LINKS...',
      'DISPATCHING ENCRYPTED EMAIL DISPATCH...'
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setTerminalLogs(prev => [...prev, steps[i]]);
      sounds.playKeyClick();
    }

    const { error } = await sendPasswordReset(email);

    if (error) {
      setTerminalLogs(prev => [...prev, 'CRITICAL CORRUPTION: EXPEDITION DISMISSED.']);
      setErrorMsg(error.message || 'Falha ao solicitar link de redefinição de senha.');
      sounds.playAlarmBreak();
      setLoading(false);
    } else {
      setTerminalLogs(prev => [...prev, 'EMAIL SECURELY EXPEDITED.']);
      setSuccessMsg('Link de redefinição enviado com sucesso! Verifique seu email para redefinir.');
      sounds.playAlarmFocusComplete();
      db.addLog(`PASSWORD RESET LINK DISPATCH REQUESTED FOR: [${email}]`, 'info');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pt-4 text-left">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-black tracking-widest text-[var(--color-amber)] select-none">
          RECOVERY_INTELLIGENCE
        </h2>
        <p className="text-[10px] text-[var(--color-amber)] opacity-70 uppercase tracking-widest">
          Recupere o acesso ao seu terminal de decolagem
        </p>
      </div>

      <form onSubmit={handleResetPassword} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xxs uppercase tracking-wider text-[var(--color-amber)] opacity-80 block font-bold">Endereço de Chave (Email)</label>
          <input
            type="email"
            required
            disabled={loading}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="operador@tva.gov"
            className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-2 text-xs text-[var(--color-amber)] focus:outline-none rounded font-mono"
          />
        </div>

        {errorMsg && (
          <div className="border border-rose-800 bg-rose-950/20 p-2.5 rounded text-xxs text-rose-400 font-bold uppercase tracking-wide leading-relaxed animate-pulse">
            [ERRO]: {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="border border-emerald-800 bg-emerald-950/20 p-2.5 rounded text-xxs text-emerald-400 font-bold uppercase tracking-wide leading-relaxed">
            [SUCESSO]: {successMsg}
          </div>
        )}

        {/* Real-time recovery simulation log */}
        {terminalLogs.length > 0 && (
          <div className="p-3 border border-[var(--color-amber)]/20 bg-[#0d0b09]/90 rounded-lg text-left text-[9px] space-y-1 font-mono text-[var(--color-amber)] leading-none select-none max-h-[100px] overflow-y-auto">
            {terminalLogs.map((log, idx) => (
              <div key={idx} className="flex gap-1.5 items-start">
                <span className="opacity-55">&gt;</span>
                <span className={log.includes('EXPEDITED') ? 'text-emerald-400 font-extrabold' : log.includes('DENIED') || log.includes('DISMISSED') ? 'text-rose-400' : ''}>
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
          {loading ? 'ENVIANDO...' : 'SOLICITAR LINK'}
        </button>
      </form>

      {/* FOOTER LINK */}
      <div className="border-t border-[var(--color-amber)]/20 pt-4 flex justify-center text-xxs text-[var(--color-amber)]/75 uppercase font-bold tracking-wider">
        <Link 
          href="/login" 
          onClick={() => sounds.playKeyClick()}
          className="hover:underline hover:text-[var(--color-amber)] cursor-pointer"
        >
          Retornar para Conexão
        </Link>
      </div>
    </div>
  );
}
