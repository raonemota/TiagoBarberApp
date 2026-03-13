import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { formatPhone } from '../lib/utils';
import { Scissors } from 'lucide-react';

const LOGO_URL = "https://zuwdcmdcrofvfexmbilg.supabase.co/storage/v1/object/public/config/426654866_357201383868846_3491990617951420183_n.jpg";

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            phone: phone,
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0502] px-4 py-12">
      <div className="w-full max-w-md space-y-8 dark-card p-8">
        <div className="flex flex-col items-center text-center">
          <img src={LOGO_URL} alt="Tiago Barber" className="w-40 h-auto mb-6" referrerPolicy="no-referrer" />
          <h2 className="text-2xl font-bold tracking-tight gold-gradient-text uppercase tracking-widest">
            Criar Conta
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Junte-se a nós para agendar seus horários
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleRegister}>
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="sr-only">
                Nome completo
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder:text-zinc-600 focus:border-gold/50 focus:ring-1 focus:ring-gold/50 sm:text-sm transition-all outline-none"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
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
              <label htmlFor="phone" className="sr-only">
                Telefone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                className="relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder:text-zinc-600 focus:border-gold/50 focus:ring-1 focus:ring-gold/50 sm:text-sm transition-all outline-none"
                placeholder="Telefone (XX) 9XXXX-XXXX"
                value={phone}
                onChange={handlePhoneChange}
                maxLength={15}
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
                minLength={6}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full flex justify-center disabled:opacity-50"
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </div>
        </form>

        <div className="text-center text-sm">
          <span className="text-zinc-500">Já tem uma conta? </span>
          <Link to="/login" className="font-bold text-gold hover:text-gold-light transition-colors">
            Faça login
          </Link>
        </div>
      </div>
    </div>
  );
}
