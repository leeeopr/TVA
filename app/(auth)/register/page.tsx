'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { sounds } from '@/lib/sounds';
import { db } from '@/lib/db';

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuthStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password || !confirmPassword) return;

    sounds.playButtonSwitch();
    setErrorMsg('');
    setTerminalLogs([]);

    // Validation checks
    if (password.length < 6) {
      setErrorMsg('A senha precisa ter pelo menos 6 caracteres.');
      sounds.playAlarmBreak();
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('A confirmação de senha não coincide.');
      sounds.playAlarmBreak();
      return;
    }

    setLoading(true);

    const steps = [
      'SANITIZING INPUT MATRICES...',
      'VALIDATING EMAIL RESOLVER...',
      'ENCRYPTING NEW IDENT OPERATOR CODES...',
      'DISPATCHING NEW PROFILE REGISTER TACTICALS...'
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setTerminalLogs(prev => [...prev, steps[i]]);
      sounds.playKeyClick();
    }

    const { error } = await signUp(email, password, username);

    if (error) {
      setTerminalLogs(prev => [...prev, 'REGISTRY FAILED: ADAPTER REJECTED SCHEMA.']);
      setErrorMsg(error.message || 'Falha ao registrar novo operador.');
      sounds.playAlarmBreak();
      setLoading(false);
    } else {
      setTerminalLogs(prev => [
        ...prev, 
        'USER AUTH CREATED.',
        'PROFILE AUTOMATICALLY INITIATED.',
        'VERIFICATION DESPATCH COMPLETED.'
      ]);
      sounds.playAlarmFocusComplete();
      db.addLog(`NEW OPERATOR CREATED SUCCESSFULLY FOR: [${email}]`, 'success');

      setTimeout(() => {
        router.push('/login');
      }, 800);
    }
  };

  return (
    <div className="space-y-6 pt-4 text-left">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-black tracking-widest text-[var(--color-amber)] select-none">
          OPERATOR_REGISTER
        </h2>
        <p className="text-[10px] text-[var(--color-amber)] opacity-70 uppercase tracking-widest">
          Crie seu novo dossiê de operador seguro do Supabase
        </p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xxs uppercase tracking-wider text-[var(--color-amber)] opacity-80 block font-bold">Nome de Operador (Username)</label>
          <input
            type="text"
            required
            disabled={loading}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ex: loki_variant_9"
            className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-2 text-xs text-[var(--color-amber)] focus:outline-none rounded font-mono"
          />
        </div>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xxs uppercase tracking-wider text-[var(--color-amber)] opacity-80 block font-bold">Senha (Senha)</label>
            <input
              type="password"
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-2 text-xs text-[var(--color-amber)] focus:outline-none rounded font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xxs uppercase tracking-wider text-[var(--color-amber)] opacity-80 block font-bold">Confirmar</label>
            <input
              type="password"
              required
              disabled={loading}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#0d0b09] border border-[var(--color-amber)]/45 focus:border-[var(--color-amber)] px-3 py-2 text-xs text-[var(--color-amber)] focus:outline-none rounded font-mono"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="border border-rose-800 bg-rose-950/20 p-2 text-xxs text-rose-400 font-bold uppercase tracking-wide leading-relaxed animate-pulse">
            [ERRO]: {errorMsg}
          </div>
        )}

        {/* Dynamic Loading steps for registry creation */}
        {terminalLogs.length > 0 && (
          <div className="p-3 border border-[var(--color-amber)]/20 bg-[#0d0b09]/90 rounded-lg text-left text-[9px] space-y-1 font-mono text-[var(--color-amber)] leading-none select-none max-h-[100px] overflow-y-auto">
            {terminalLogs.map((log, idx) => (
              <div key={idx} className="flex gap-1.5 items-start">
                <span className="opacity-55">&gt;</span>
                <span className={log.includes('CREATED') || log.includes('COMPLETED') ? 'text-emerald-400 font-extrabold' : log.includes('FAILED') ? 'text-rose-400' : ''}>
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
          {loading ? 'REGISTRANDO...' : 'SOLICITAR NOVO DOSSIÊ'}
        </button>
      </form>

      {/* HELPER LINK BACK TO LOGINS */}
      <div className="border-t border-[var(--color-amber)]/20 pt-4 flex justify-center text-xxs text-[var(--color-amber)]/75 uppercase font-bold tracking-wider">
        <Link 
          href="/login" 
          onClick={() => sounds.playKeyClick()}
          className="hover:underline hover:text-[var(--color-amber)] cursor-pointer"
        >
          Operador já possui Identificador? Conecte-se
        </Link>
      </div>
    </div>
  );
}
