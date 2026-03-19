import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  History, 
  TrendingUp, 
  Crown, 
  User as UserIcon,
  ChevronRight,
  AlertCircle,
  X,
  Trash2,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { format, parseISO, isAfter, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router';

interface Appointment {
  id: string;
  date: string;
  start_time: string;
  end_time?: string;
  status: string;
  notes?: string;
  service: { id: string; name: string; price: number; duration_minutes: number };
  barber: { id: string; users: { name: string } };
  client?: { name: string };
}

export default function Profile() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (profile) fetchUserAppointments();
  }, [profile]);

  const fetchUserAppointments = async () => {
    try {
      let query = supabase
        .from('appointments')
        .select(`
          id, date, start_time, end_time, status, notes,
          service:services(name, price, duration_minutes),
          barber:barbers(users:user_id(name)),
          client:users!client_id(name)
        `);

      if (profile?.role === 'barber') {
        const { data: barberData } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', profile.id)
          .single();

        if (barberData) {
          const { data, error } = await supabase
            .from('appointments')
            .select(`
              id, date, start_time, end_time, status, notes,
              service:services(name, price, duration_minutes),
              barber:barbers(users:user_id(name)),
              client:users!client_id(name)
            `)
            .eq('barber_id', barberData.id)
            .order('date', { ascending: false })
            .order('start_time', { ascending: false });
          
          if (error) throw error;
          setAppointments(data as any);
          return;
        }
      }

      const { data, error } = await query
        .eq('client_id', profile?.id)
        .order('date', { ascending: false })
        .order('start_time', { ascending: false });

      if (error) throw error;
      setAppointments(data as any);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (!confirm('Tem certeza que deseja cancelar este agendamento específico?')) return;
    
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
      
      showNotification('Agendamento cancelado com sucesso.');
      setSelectedAppointment(null);
      fetchUserAppointments();
    } catch (error: any) {
      showNotification(error.message, 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = (apt: Appointment) => {
    const unitId = (apt as any).unit_id;
    const serviceId = (apt as any).service_id || apt.service?.id;
    const barberId = (apt as any).barber_id || apt.barber?.id;
    
    let url = `/booking?reschedule=${apt.id}`;
    if (unitId) url += `&unit=${unitId}`;
    if (serviceId) url += `&service=${serviceId}`;
    if (barberId) url += `&barber=${barberId}`;
    
    navigate(url);
  };

  const activeAppointments = appointments.filter(apt => 
    (apt.status === 'pending' || apt.status === 'confirmed' || apt.status === 'scheduled') && 
    (isAfter(parseISO(apt.date), startOfToday()) || apt.date === format(new Date(), 'yyyy-MM-dd'))
  );

  const pastAppointments = appointments.filter(apt => 
    apt.status === 'completed' || apt.status === 'cancelled' || 
    (!isAfter(parseISO(apt.date), startOfToday()) && apt.date !== format(new Date(), 'yyyy-MM-dd'))
  );

  const totalSpent = appointments
    .filter(apt => apt.status === 'completed')
    .reduce((acc, apt) => acc + (apt.service?.price || 0), 0);

  // AGRUPAMENTO DOS ATIVOS VISUALMENTE
  const groupedActive = useMemo(() => {
    const groups = new Map<string, Appointment[]>();
    activeAppointments.forEach(apt => {
       const personName = profile?.role === 'barber' ? ((apt as any).client?.name || 'Cliente') : (apt.barber?.users?.name || 'Profissional');
       const key = `${apt.date}_${personName}`;
       if (!groups.has(key)) groups.set(key, []);
       groups.get(key)!.push(apt);
    });
    return Array.from(groups.values());
  }, [activeAppointments, profile?.role]);

  // AGRUPAMENTO DO HISTÓRICO VISUALMENTE
  const groupedHistory = useMemo(() => {
    const groups = new Map<string, Appointment[]>();
    pastAppointments.forEach(apt => {
       const personName = profile?.role === 'barber' ? ((apt as any).client?.name || 'Cliente') : (apt.barber?.users?.name || 'Profissional');
       const key = `${apt.date}_${personName}`;
       if (!groups.has(key)) groups.set(key, []);
       groups.get(key)!.push(apt);
    });
    return Array.from(groups.values());
  }, [pastAppointments, profile?.role]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Profile Header Card */}
      <section className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#1a1a1a] p-6 border border-zinc-200 dark:border-white/5 shadow-sm">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <UserIcon className="h-24 w-24 text-gold" />
        </div>
        
        <div className="flex items-center gap-4 mb-6">
          <div className="h-20 w-20 rounded-full border-2 border-gold/30 p-1">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full rounded-full object-cover" />
            ) : (
              <div className="h-full w-full rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <UserIcon className="h-8 w-8 text-gold" />
              </div>
            )}
          </div>
          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">{profile?.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              {profile?.role === 'admin' ? (
                <span className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-2 py-1 rounded-full">
                  Administrador
                </span>
              ) : profile?.role === 'barber' ? (
                <span className="flex items-center gap-1 text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded-full">
                  Profissional Barbeiro
                </span>
              ) : profile?.subscription_type === 'clube' ? (
                <span className="flex items-center gap-1 text-[10px] font-black text-gold uppercase tracking-widest bg-gold/10 px-2 py-1 rounded-full">
                  <Crown className="h-3 w-3" /> Membro do Clube
                </span>
              ) : (
                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Cliente Standard</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-zinc-200 dark:border-white/5 pt-6">
          <div className="text-center">
            <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1">
              {profile?.role === 'barber' ? 'Atendimentos' : 'Serviços'}
            </p>
            <p className="text-xl font-black text-zinc-900 dark:text-white">{appointments.filter(a => a.status === 'completed').length}</p>
          </div>
          <div className="text-center border-x border-zinc-200 dark:border-white/5">
            <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1">
              {profile?.role === 'barber' ? 'Faturamento' : 'Investido'}
            </p>
            <p className="text-xl font-black text-gold">R$ {totalSpent.toFixed(2).replace('.', ',')}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1">Nível</p>
            <p className="text-xl font-black text-zinc-900 dark:text-white">
              {profile?.role === 'barber' ? 'Master' : 'Bronze'}
            </p>
          </div>
        </div>
      </section>

      {/* Active Appointments */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gold" />
            <h3 className="text-[10px] font-bold text-gold uppercase tracking-widest">Agendamentos Ativos</h3>
          </div>
          <span className="h-[1px] flex-1 bg-zinc-200 dark:bg-white/5 mx-4"></span>
        </div>

        {groupedActive.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupedActive.map((group, index) => {
              const firstApt = group[0];
              const personName = profile?.role === 'barber' ? (firstApt as any).client?.name : firstApt.barber?.users?.name;
              const startTime = firstApt.start_time.substring(0, 5);
              const validGroup = group.filter(a => a.status !== 'cancelled');
              const totalPrice = validGroup.reduce((sum, a) => sum + (a.service?.price || 0), 0);
              
              return (
                <div key={index} className="bg-white dark:bg-[#1a1a1a] p-4 w-full flex flex-col hover:border-gold/30 transition-all border border-zinc-200 dark:border-white/5 rounded-2xl shadow-sm">
                  <div className="flex items-start gap-4 mb-3 pb-3 border-b border-zinc-200 dark:border-white/5">
                    <div className="h-12 w-12 rounded-xl bg-gold/10 flex flex-col items-center justify-center text-gold border border-gold/20 shrink-0">
                        <span className="text-[10px] font-black leading-none mb-0.5">{format(parseISO(firstApt.date), 'dd')}</span>
                        <span className="text-[8px] font-bold uppercase">{format(parseISO(firstApt.date), 'MMM', { locale: ptBR })}</span>
                      </div>
                      <div>
                        <p className="font-black text-zinc-900 dark:text-white uppercase tracking-tight">{personName}</p>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest mt-1">
                          <Clock className="h-3 w-3" /> Início às {startTime}
                        </div>
                      </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    {group.map(apt => (
                        <div key={apt.id} className="flex items-center justify-between group/item">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                              {apt.service?.name}
                              {apt.status === 'cancelled' && <span className="ml-2 text-[8px] text-red-500 bg-red-500/10 px-1 rounded uppercase tracking-widest">Cancelado</span>}
                            </span>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                              {apt.start_time.substring(0,5)} {apt.end_time ? `- ${apt.end_time.substring(0,5)}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-black ${apt.status === 'cancelled' ? 'text-zinc-400 dark:text-zinc-600 line-through' : 'text-gold'}`}>
                              R$ {apt.service?.price?.toFixed(2)}
                            </span>
                            
                            {apt.status !== 'cancelled' && (
                              <button onClick={() => setSelectedAppointment(apt)} className="p-1 text-zinc-400 dark:text-zinc-600 hover:text-gold transition-colors opacity-0 group-hover/item:opacity-100" title="Detalhes / Gerenciar">
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-white/5">
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Total da Comanda</span>
                    <span className="text-sm font-black text-zinc-900 dark:text-white">R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 bg-zinc-50 dark:bg-white/5 rounded-3xl border border-dashed border-zinc-200 dark:border-white/10">
            <AlertCircle className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
            <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Nenhum agendamento ativo</p>
          </div>
        )}
      </section>

      {/* History */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-500" />
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Histórico de Serviços</h3>
          </div>
          <span className="h-[1px] flex-1 bg-zinc-200 dark:bg-white/5 mx-4"></span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto no-scrollbar pr-1 pb-4">
          {groupedHistory.map((group, index) => {
            const firstApt = group[0];
            const isCancelled = group.every(a => a.status === 'cancelled');
            const isCompleted = group.every(a => a.status === 'completed');
            
            // Valor total: soma apenas o que não foi cancelado
            const totalPrice = group.reduce((sum, a) => a.status !== 'cancelled' ? sum + (a.service?.price || 0) : sum, 0);

            return (
              <div key={index} className={`flex flex-col p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-white/5 ${isCancelled ? 'opacity-60 grayscale-[50%]' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isCancelled ? 'bg-red-500/10 text-red-500' : isCompleted ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600'}`}>
                      {isCancelled ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-[9px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest">
                        {format(parseISO(firstApt.date), "dd 'de' MMM", { locale: ptBR })} • Início {firstApt.start_time.substring(0, 5)}
                      </p>
                      {isCancelled && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 font-black uppercase tracking-widest inline-block mt-0.5">
                          Cancelado
                        </span>
                      )}
                    </div>
                  </div>
                  <p className={`text-sm font-black ${isCancelled ? 'text-zinc-400 dark:text-zinc-600 line-through' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    R$ {totalPrice.toFixed(2).replace('.', ',')}
                  </p>
                </div>
                
                <div className="pl-14 space-y-1">
                   {group.map(apt => (
                      <div key={apt.id} className="flex justify-between items-center">
                         <span className={`text-xs font-bold ${apt.status === 'cancelled' ? 'text-zinc-400 dark:text-zinc-600 line-through' : 'text-zinc-600 dark:text-zinc-400'}`}>
                           • {apt.service?.name}
                         </span>
                         <span className={`text-[10px] font-bold ${apt.status === 'cancelled' ? 'text-zinc-400 dark:text-zinc-600 line-through' : 'text-zinc-500'}`}>
                           R$ {apt.service?.price?.toFixed(2)}
                         </span>
                      </div>
                   ))}
                </div>
              </div>
            );
          })}
          
          {groupedHistory.length === 0 && (
            <div className="col-span-full text-center py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">
              Seu histórico está vazio.
            </div>
          )}
        </div>
      </section>

      {/* Subscription Status */}
      <section className={`rounded-3xl p-6 border shadow-sm transition-all duration-300 ${
        profile?.subscription_type === 'clube' 
          ? 'bg-gold/5 border-gold/10' 
          : 'bg-gradient-to-br from-zinc-900 to-black border-zinc-800 dark:border-white/5'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`font-black uppercase tracking-tight flex items-center gap-2 ${
            profile?.subscription_type === 'clube' ? 'text-zinc-900 dark:text-white' : 'text-white'
          }`}>
            <Crown className={`h-5 w-5 ${profile?.subscription_type === 'clube' ? 'text-gold' : 'text-gold animate-pulse'}`} /> 
            {profile?.subscription_type === 'clube' ? 'Fidelidade & Clube' : 'Seja Membro do Clube'}
          </h3>
          <ChevronRight className="h-5 w-5 text-gold" />
        </div>
        
        <div className="space-y-4 mb-6">
          <p className={`text-xs leading-relaxed ${
            profile?.subscription_type === 'clube' ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-300'
          }`}>
            {profile?.subscription_type === 'clube' 
              ? 'Você economizou R$ 45,00 este mês com sua assinatura do Clube. Aproveite seus benefícios exclusivos!'
              : 'Tenha cortes ilimitados, prioridade no agendamento e descontos exclusivos em produtos e serviços. A partir de R$ 89,90/mês.'}
          </p>
          
          {profile?.subscription_type !== 'clube' && (
            <div className="flex flex-wrap gap-2">
              <span className="text-[8px] font-black uppercase tracking-widest bg-gold/20 text-gold px-2 py-1 rounded-full border border-gold/30">Cortes Ilimitados</span>
              <span className="text-[8px] font-black uppercase tracking-widest bg-gold/20 text-gold px-2 py-1 rounded-full border border-gold/30">Prioridade VIP</span>
              <span className="text-[8px] font-black uppercase tracking-widest bg-gold/20 text-gold px-2 py-1 rounded-full border border-gold/30">Descontos em Produtos</span>
            </div>
          )}
        </div>

        <button 
          onClick={() => navigate('/club')}
          className={`w-full py-4 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg ${
            profile?.subscription_type === 'clube' 
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10' 
              : 'bg-gold text-black shadow-gold/20'
          }`}
        >
          {profile?.subscription_type === 'clube' ? 'Gerenciar Assinatura' : 'Ver Planos e Assinar'}
        </button>
      </section>

      {/* Appointment Details Modal */}
      <AnimatePresence>
        {selectedAppointment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 dark:bg-black/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1a1a1a] p-8 rounded-3xl max-w-md w-full space-y-8 relative border border-zinc-200 dark:border-white/5 shadow-2xl"
            >
              <button 
                onClick={() => setSelectedAppointment(null)}
                className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>

              <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 bg-gold/10 text-gold rounded-2xl flex items-center justify-center border border-gold/20 mb-4">
                  <Calendar className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Detalhes do Serviço</h3>
                <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Confira as informações abaixo</p>
              </div>

              <div className="space-y-4 bg-zinc-50 dark:bg-white/5 rounded-2xl p-6 border border-zinc-200 dark:border-white/5">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mt-1">Serviço</span>
                  <div className="text-right">
                    <span className="font-black text-zinc-900 dark:text-white uppercase block">
                      {selectedAppointment.service?.name}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Profissional</span>
                  <span className="font-black text-zinc-900 dark:text-white uppercase">{selectedAppointment.barber?.users?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Data</span>
                  <span className="font-black text-zinc-900 dark:text-white uppercase">{format(parseISO(selectedAppointment.date), "dd 'de' MMMM", { locale: ptBR })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Horário</span>
                  <span className="font-black text-gold uppercase">
                    {selectedAppointment.start_time.substring(0, 5)} 
                    {selectedAppointment.end_time && ` - ${selectedAppointment.end_time.substring(0, 5)}`}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-zinc-200 dark:border-white/5">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Valor</span>
                  <span className="font-black text-xl text-gold">
                    R$ {selectedAppointment.service?.price?.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleReschedule(selectedAppointment)}
                  className="flex items-center justify-center gap-2 py-4 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-white/10 transition-all"
                >
                  <RefreshCw className="h-4 w-4" /> Reagendar
                </button>
                <button
                  disabled={cancelling}
                  onClick={() => handleCancelAppointment(selectedAppointment.id)}
                  className="flex items-center justify-center gap-2 py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-50"
                >
                  {cancelling ? 'Cancelando...' : <><Trash2 className="h-4 w-4" /> Cancelar</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}