import { useState, useEffect } from 'react';
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
  RefreshCw
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
        // If barber, we might want to see both their own appointments as a client 
        // AND their appointments as a barber.
        // But usually, a barber profile should show their professional stats.
        // Let's fetch appointments where they are the barber.
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
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;
    
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
    // Navigate to booking with params to reschedule
    // We'll pass the unit if available, and the service
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
    apt.status === 'completed' || 
    (!isAfter(parseISO(apt.date), startOfToday()) && apt.date !== format(new Date(), 'yyyy-MM-dd'))
  );

  const totalSpent = appointments
    .filter(apt => apt.status === 'completed')
    .reduce((acc, apt) => acc + (apt.service?.price || 0), 0);

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
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1614] to-[#0a0502] p-6 border border-white/5">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <UserIcon className="h-24 w-24 text-gold" />
        </div>
        
        <div className="flex items-center gap-4 mb-6">
          <div className="h-20 w-20 rounded-full border-2 border-gold/30 p-1">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full rounded-full object-cover" />
            ) : (
              <div className="h-full w-full rounded-full bg-zinc-800 flex items-center justify-center">
                <UserIcon className="h-8 w-8 text-gold" />
              </div>
            )}
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">{profile?.name}</h2>
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
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Cliente Standard</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-6">
          <div className="text-center">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
              {profile?.role === 'barber' ? 'Atendimentos' : 'Serviços'}
            </p>
            <p className="text-xl font-black text-white">{appointments.filter(a => a.status === 'completed').length}</p>
          </div>
          <div className="text-center border-x border-white/5">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
              {profile?.role === 'barber' ? 'Faturamento' : 'Investido'}
            </p>
            <p className="text-xl font-black text-gold">R$ {totalSpent}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Nível</p>
            <p className="text-xl font-black text-white">
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
          <span className="h-[1px] flex-1 bg-white/5 mx-4"></span>
        </div>

        {activeAppointments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAppointments.map((apt) => (
              <button 
                key={apt.id} 
                onClick={() => setSelectedAppointment(apt)}
                className="dark-card p-4 flex items-center justify-between group text-left w-full hover:border-gold/30 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-gold/10 flex flex-col items-center justify-center text-gold border border-gold/20">
                    <span className="text-[10px] font-black leading-none mb-0.5">{format(parseISO(apt.date), 'dd')}</span>
                    <span className="text-[8px] font-bold uppercase">{format(parseISO(apt.date), 'MMM', { locale: ptBR })}</span>
                  </div>
                  <div>
                    <p className="font-black text-white uppercase tracking-tight">{apt.service?.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                      <Clock className="h-3 w-3" /> {apt.start_time} • {profile?.role === 'barber' ? (apt as any).client?.name : apt.barber?.users?.name}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-block px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest">
                    Confirmado
                  </span>
                  <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-gold transition-colors" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-white/5 rounded-3xl border border-dashed border-white/10">
            <AlertCircle className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Nenhum agendamento ativo</p>
          </div>
        )}
      </section>

      {/* History */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-500" />
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Últimos Serviços</h3>
          </div>
          <span className="h-[1px] flex-1 bg-white/5 mx-4"></span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pastAppointments.slice(0, 6).map((apt) => (
            <div key={apt.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-300">{apt.service?.name}</p>
                  <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                    {format(parseISO(apt.date), "dd 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <p className="text-sm font-black text-zinc-500">R$ {apt.service?.price}</p>
            </div>
          ))}
          
          {pastAppointments.length === 0 && (
            <p className="text-center py-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Histórico vazio</p>
          )}
        </div>
      </section>

      {/* Subscription Status */}
      <section className="bg-gold/5 rounded-3xl p-6 border border-gold/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-white uppercase tracking-tight flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gold" /> Fidelidade & Clube
          </h3>
          <ChevronRight className="h-5 w-5 text-gold" />
        </div>
        <p className="text-xs text-zinc-400 mb-4">
          {profile?.subscription_type === 'clube' 
            ? 'Você economizou R$ 45,00 este mês com sua assinatura do Clube.'
            : 'Assine o Clube Tiago Barber e tenha cortes ilimitados e descontos exclusivos.'}
        </p>
        <button className="w-full py-3 bg-gold text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:scale-[1.02] transition-transform">
          {profile?.subscription_type === 'clube' ? 'Gerenciar Assinatura' : 'Conhecer o Clube'}
        </button>
      </section>

      {/* Appointment Details Modal */}
      <AnimatePresence>
        {selectedAppointment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="dark-card p-8 max-w-md w-full space-y-8 relative"
            >
              <button 
                onClick={() => setSelectedAppointment(null)}
                className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>

              <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 bg-gold/10 text-gold rounded-2xl flex items-center justify-center border border-gold/20 mb-4">
                  <Calendar className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Detalhes do Agendamento</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Confira as informações abaixo</p>
              </div>

              <div className="space-y-4 bg-white/5 rounded-2xl p-6 border border-white/5">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Serviço(s)</span>
                  <div className="text-right">
                    <span className="font-black text-white uppercase block">
                      {selectedAppointment.notes?.startsWith('Serviços:') 
                        ? selectedAppointment.notes.split('|')[0].replace('Serviços:', '').trim()
                        : selectedAppointment.service?.name}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Profissional</span>
                  <span className="font-black text-white uppercase">{selectedAppointment.barber?.users?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Data</span>
                  <span className="font-black text-white uppercase">{format(parseISO(selectedAppointment.date), "dd 'de' MMMM", { locale: ptBR })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Horário</span>
                  <span className="font-black text-gold uppercase">
                    {selectedAppointment.start_time.substring(0, 5)} 
                    {selectedAppointment.end_time && ` - ${selectedAppointment.end_time.substring(0, 5)}`}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-white/5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Valor</span>
                  <span className="font-black text-xl text-gold">
                    {selectedAppointment.notes?.includes('| Total: R$')
                      ? `R$ ${selectedAppointment.notes.split('| Total: R$')[1].trim().replace('.', ',')}`
                      : `R$ ${selectedAppointment.service?.price.toFixed(2).replace('.', ',')}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleReschedule(selectedAppointment)}
                  className="flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
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
