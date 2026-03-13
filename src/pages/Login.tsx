import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { formatPhone } from '../lib/utils';
import { Scissors } from 'lucide-react';

const LOGO_URL = "https://zuwdcmdcrofvfexmbilg.supabase.co/storage/v1/object/public/config/426654866_357201383868846_3491990617951420183_n.jpg";

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0502] px-4">
      <div className="w-full max-w-md space-y-8 dark-card p-8">
        <div className="flex flex-col items-center text-center">
          <img src={LOGO_URL} alt="Tiago Barber" className="w-48 h-auto mb-6" referrerPolicy="no-referrer" />
          <h2 className="text-2xl font-bold tracking-tight gold-gradient-text uppercase tracking-widest">
            Bem-vindo
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Faça login para gerenciar seus agendamentos
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder:text-zinc-600 focus:border-gold/50 focus:ring-1 focus:ring-gold/50 sm:text-sm transition-all outline-none"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder:text-zinc-600 focus:border-gold/50 focus:ring-1 focus:ring-gold/50 sm:text-sm transition-all outline-none"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full flex justify-center disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>

        <div className="text-center text-sm">
          <span className="text-zinc-500">Não tem uma conta? </span>
          <Link to="/register" className="font-bold text-gold hover:text-gold-light transition-colors">
            Cadastre-se
          </Link>
        </div>
      </div>
    </div>
  );
}
