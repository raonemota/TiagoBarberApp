import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Star, ArrowRight, Shield, Zap, Crown, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router';

interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
  is_featured: boolean;
  image_url: string;
  benefits?: {
    service_id: string;
    discount_percentage: number;
    service?: {
      name: string;
    };
  }[];
}

export default function SubscriptionClub() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotification();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*, benefits:plan_benefits(service_id, discount_percentage, service:services(name))')
        .order('price', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      console.error('Error fetching plans:', error);
      addNotification('Erro ao carregar planos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      addNotification('Você precisa estar logado para assinar um plano', 'info');
      navigate('/login');
      return;
    }

    try {
      // In a real app, this would redirect to a payment gateway (Stripe, etc.)
      // For now, we'll just create the subscription record
      const { error } = await supabase
        .from('user_subscriptions')
        .insert([{
          user_id: user.id,
          plan_id: planId,
          status: 'active',
          next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }]);

      if (error) throw error;
      addNotification('Assinatura realizada com sucesso!', 'success');
      navigate('/profile');
    } catch (error: any) {
      console.error('Error subscribing:', error);
      addNotification('Erro ao realizar assinatura', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto relative">
        <button 
          onClick={() => navigate(-1)}
          className="absolute -top-4 left-0 p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div className="text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-gold to-yellow-600 bg-clip-text text-transparent"
          >
            Clube de Assinatura
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-600 dark:text-zinc-400 text-lg max-w-2xl mx-auto"
          >
            Escolha o plano ideal para você e aproveite benefícios exclusivos, descontos e prioridade no agendamento.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-8 border ${
                plan.is_featured 
                  ? 'border-gold shadow-lg shadow-gold/10' 
                  : 'border-zinc-200 dark:border-zinc-800'
              } flex flex-col`}
            >
              {plan.is_featured && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gold text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  MAIS POPULAR
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2 text-zinc-900 dark:text-white">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-zinc-900 dark:text-white">R$ {plan.price.toFixed(2)}</span>
                  <span className="text-zinc-500">/mês</span>
                </div>
              </div>

              <div className="flex-grow mb-8">
                <p className="text-zinc-600 dark:text-zinc-400 mb-6">{plan.description}</p>
                <ul className="space-y-4">
                  {plan.benefits && plan.benefits.length > 0 ? (
                    plan.benefits.map((benefit, bIndex) => (
                      <li key={bIndex} className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                        <Check className="w-5 h-5 text-gold flex-shrink-0" />
                        <span>
                          {benefit.discount_percentage === 100 
                            ? `${benefit.service?.name} Ilimitado` 
                            : `${benefit.discount_percentage}% de desconto em ${benefit.service?.name}`}
                        </span>
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                        <Check className="w-5 h-5 text-gold" />
                        <span>Prioridade no agendamento</span>
                      </li>
                      <li className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                        <Check className="w-5 h-5 text-gold" />
                        <span>Descontos exclusivos</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              <button
                onClick={() => handleSubscribe(plan.id)}
                className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                  plan.is_featured
                    ? 'bg-gold text-black hover:bg-yellow-600'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                Assinar Agora
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div>
            <div className="bg-gold/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-gold" />
            </div>
            <h4 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">Segurança</h4>
            <p className="text-zinc-600 dark:text-zinc-400">Pagamentos seguros e recorrentes sem preocupações.</p>
          </div>
          <div>
            <div className="bg-gold/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Zap className="w-8 h-8 text-gold" />
            </div>
            <h4 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">Praticidade</h4>
            <p className="text-zinc-600 dark:text-zinc-400">Agende seu horário com prioridade em qualquer unidade.</p>
          </div>
          <div>
            <div className="bg-gold/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Crown className="w-8 h-8 text-gold" />
            </div>
            <h4 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">Exclusividade</h4>
            <p className="text-zinc-600 dark:text-zinc-400">Acesso a eventos e promoções exclusivas para membros.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
