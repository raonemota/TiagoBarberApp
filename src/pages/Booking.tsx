import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, ChevronRight, CheckCircle2, Scissors, Sparkles, Zap, Star, Clock, Calendar, X, RefreshCw } from 'lucide-react';
import { format, addDays, startOfToday, addMinutes, parse, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'motion/react';

const Mustache = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M4 12c0 2 2 4 4 4s4-2 4-4c0 2 2 4 4 4s4-2 4-4" />
    <path d="M4 12c0-2 2-4 4-4s4 2 4 4c0-2 2-4 4-4s4 2 4 4" />
  </svg>
);

const getServiceIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('corte')) return Scissors;
  if (lowerName.includes('barba')) return Mustache;
  if (lowerName.includes('combo')) return Zap;
  if (lowerName.includes('sobrancelha')) return Sparkles;
  return Star;
};

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
}

interface Barber {
  id: string;
  users: any;
}

const BARBER_ILLUSTRATION = "https://zuwdcmdcrofvfexmbilg.supabase.co/storage/v1/object/public/config/barber-illustration.png";
const UNKNOWN_BARBER_IMAGE = "https://zuwdcmdcrofvfexmbilg.supabase.co/storage/v1/object/public/avatars/unknown_prof.png";

export default function Booking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [lastAppointment, setLastAppointment] = useState<any>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  
  // Estados para o Calendário Personalizado
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(startOfMonth(startOfToday()));
  
  // Guarda os horários calculados de todos os dias
  const [slotsPerDate, setSlotsPerDate] = useState<Record<string, string[]>>({});
  
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Gera os 14 dias iniciais para mostrar na rolagem rápida
  const defaultDates = useMemo(() => Array.from({ length: 14 }).map((_, i) => addDays(startOfToday(), i)), []);

  useEffect(() => {
    fetchServicesAndBarbers();
    if (profile) {
      fetchLastAppointment();
    }
  }, [profile]);

  const fetchLastAppointment = async () => {
    if (!profile) return;
    
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, 
          service_id, 
          barber_id,
          service:services(id, name, price, duration_minutes),
          barber:barbers(id, users:user_id(name, avatar_url))
        `)
        .eq('client_id', profile.id)
        .eq('status', 'completed')
        .order('date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setLastAppointment(data);
        setShowSuggestion(true);
      }
    } catch (error) {
      console.error('Error fetching last appointment:', error);
    }
  };

  // Quando o serviço ou barbeiro mudar, pré-calcula a disponibilidade de 60 dias
  useEffect(() => {
    if (selectedServices.length > 0 && selectedBarber) {
      setSlotsPerDate({});
      calculateAllDatesAvailability();
    } else {
      setSlotsPerDate({});
    }
  }, [selectedServices, selectedBarber]);

  const fetchServicesAndBarbers = async () => {
    const unitId = searchParams.get('unit');
    
    const { data: servicesData } = await supabase.from('services').select('*');
    if (servicesData) setServices(servicesData);

    let query = supabase
      .from('barbers')
      .select(`
        id, 
        unit_id, 
        user_id,
        users:user_id (
          name, 
          avatar_url
        )
      `);
    
    if (unitId) {
      query = query.eq('unit_id', unitId);
    }

    const { data: barbersData } = await query;
    if (barbersData) setBarbers(barbersData as any);

    const serviceId = searchParams.get('service');
    if (serviceId && servicesData) {
      const srv = servicesData.find(s => s.id === serviceId);
      if (srv) {
        setSelectedServices([srv]);
      }
    }

    const barberId = searchParams.get('barber');
    if (barberId) {
      setSelectedBarber(barberId);
    }
  };

  const calculateAllDatesAvailability = async () => {
    if (!selectedBarber) return;
    setLoading(true);

    try {
      let barberId = selectedBarber;
      if (selectedBarber === 'any') {
        barberId = barbers[0]?.id;
      }

      // Calcula para os próximos 60 dias
      const allDatesToCalculate = Array.from({ length: 60 }).map((_, i) => addDays(startOfToday(), i));
      const todayStr = format(allDatesToCalculate[0], 'yyyy-MM-dd');
      const lastDateStr = format(allDatesToCalculate[allDatesToCalculate.length - 1], 'yyyy-MM-dd');

      const { data: availabilityData } = await supabase
        .from('barber_availability')
        .select('*')
        .eq('barber_id', barberId)
        .eq('is_active', true);

      const { data: bookedAppointments } = await supabase
        .from('appointments')
        .select('date, start_time, end_time')
        .eq('barber_id', barberId)
        .gte('date', todayStr)
        .lte('date', lastDateStr)
        .not('status', 'eq', 'cancelled');

      const { data: blocks } = await supabase
        .from('barber_blocks')
        .select('*')
        .eq('barber_id', barberId)
        .gte('date', todayStr)
        .lte('date', lastDateStr);

      const totalDuration = selectedServices.reduce((acc, s) => acc + s.duration_minutes, 0);

      const addMins = (timeStr: string, mins: number) => {
        const parsed = parse(timeStr, 'HH:mm', new Date());
        return format(addMinutes(parsed, mins), 'HH:mm');
      };

      const newSlotsPerDate: Record<string, string[]> = {};

      for (const date of allDatesToCalculate) {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = date.getDay();
        
        const availability = availabilityData?.find(a => a.day_of_week === dayOfWeek);
        if (!availability) {
          newSlotsPerDate[dateStr] = [];
          continue;
        }

        const dayAppointments = bookedAppointments?.filter(a => a.date === dateStr) || [];
        const dayBlocks = blocks?.filter(b => b.date === dateStr) || [];

        const slots = [];
        let current = availability.start_time.substring(0, 5);
        const shiftEnd = availability.end_time.substring(0, 5);

        const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
        const nowTime = format(new Date(), 'HH:mm');

        while (current < shiftEnd) {
          if (isToday && current <= nowTime) {
              current = addMins(current, 30);
              continue;
          }

          const proposedEnd = addMins(current, totalDuration);
          if (proposedEnd > shiftEnd) break;

          const isOverlappingAppointment = dayAppointments.some(apt => {
            const aptStart = apt.start_time.substring(0, 5);
            const aptEnd = apt.end_time.substring(0, 5);
            return current < aptEnd && proposedEnd > aptStart;
          });

          const isOverlappingBlock = dayBlocks.some(block => {
            if (!block.start_time) return true; 
            const blockStart = block.start_time.substring(0, 5);
            const blockEnd = block.end_time.substring(0, 5);
            return current < blockEnd && proposedEnd > blockStart;
          });

          if (!isOverlappingAppointment && !isOverlappingBlock) {
            slots.push(current);
          }
          
          current = addMins(current, 30);
        }

        newSlotsPerDate[dateStr] = slots;
      }

      setSlotsPerDate(newSlotsPerDate);
    } catch (error) {
      console.error('Error calculating times:', error);
      setSlotsPerDate({});
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (service: Service) => {
    setSelectedServices(prev => {
      const isSelected = prev.find(s => s.id === service.id);
      if (isSelected) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  const totalPrice = selectedServices.reduce((acc, s) => acc + s.price, 0);
  const totalDuration = selectedServices.reduce((acc, s) => acc + s.duration_minutes, 0);

  const availableTimes = slotsPerDate[format(selectedDate, 'yyyy-MM-dd')] || [];

  const handleBooking = async () => {
    if (selectedServices.length === 0 || !selectedTime || !profile) return;
    setLoading(true);

    try {
      let barberId = selectedBarber;
      if (selectedBarber === 'any') {
        const randomIndex = Math.floor(Math.random() * barbers.length);
        barberId = barbers[randomIndex]?.id;
      }

      if (!barberId) {
        throw new Error('Nenhum barbeiro disponível para esta unidade.');
      }

      const unitId = searchParams.get('unit');
      const rescheduleId = searchParams.get('reschedule');

      // Gera um ID Único de Comanda para vincular os agendamentos
      const comandaId = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      let currentStartTimeDate = parse(selectedTime, 'HH:mm', new Date());
      const appointmentsToInsert = [];
      let firstAppointmentData = null;

      // Cria um registro no banco SEQUENCIAL E SEPARADO para cada serviço
      for (let i = 0; i < selectedServices.length; i++) {
        const service = selectedServices[i];
        
        const startTimeStr = format(currentStartTimeDate, 'HH:mm');
        const endTimeDate = addMinutes(currentStartTimeDate, service.duration_minutes);
        const endTimeStr = format(endTimeDate, 'HH:mm');

        const appointmentData = {
          client_id: profile.id,
          barber_id: barberId,
          service_id: service.id, // O ID do serviço fica perfeito no banco
          unit_id: unitId,
          date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: startTimeStr,
          end_time: endTimeStr,
          status: 'scheduled',
          // Vinculamos os serviços usando a nota
          notes: `Comanda #${comandaId}${rescheduleId ? ' (Reagendamento)' : ''}`
        };

        if (i === 0) {
          firstAppointmentData = appointmentData;
        } else {
          appointmentsToInsert.push(appointmentData);
        }

        // Avança o horário para o próximo serviço na fila
        currentStartTimeDate = endTimeDate;
      }

      // Executa no Banco de Dados
      if (rescheduleId) {
        const { error: updateError } = await supabase
          .from('appointments')
          .update(firstAppointmentData)
          .eq('id', rescheduleId);
        if (updateError) throw updateError;
        
        if (appointmentsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('appointments')
            .insert(appointmentsToInsert);
          if (insertError) throw insertError;
        }
      } else {
        const allAppointments = [firstAppointmentData, ...appointmentsToInsert];
        const { error: insertError } = await supabase
          .from('appointments')
          .insert(allAppointments);
          
        if (insertError) throw insertError;
      }

      setShowModal(true);
    } catch (error) {
      console.error('Error booking:', error);
    } finally {
      setLoading(false);
    }
  };

  // Junta as datas padrões e a data escolhida pelo calendário para exibir na interface
  const displayDates = useMemo(() => {
    const list = [...defaultDates];
    if (customDate && !list.some(d => format(d, 'yyyy-MM-dd') === format(customDate, 'yyyy-MM-dd'))) {
      list.push(customDate);
      list.sort((a, b) => a.getTime() - b.getTime()); // Ordena cronologicamente
    }
    return list;
  }, [defaultDates, customDate]);

  const handleUseSuggestion = () => {
    if (!lastAppointment) return;
    
    const service = lastAppointment.service;
    const barberId = lastAppointment.barber_id;
    
    if (service) {
      setSelectedServices([service]);
    }
    
    if (barberId) {
      setSelectedBarber(barberId);
    }
    
    setShowSuggestion(false);
    setStep(2); // Move to professional and time
  };

  return (
    <div className="mx-auto max-w-lg md:max-w-4xl lg:max-w-6xl bg-white dark:bg-[#0a0502] min-h-screen pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0a0502]/95 backdrop-blur-md px-4 py-2 border-b border-zinc-200 dark:border-white/5 flex items-center -mx-4 mb-4">
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate('/')} className="p-2 text-gold hover:bg-zinc-100 dark:hover:bg-white/5 rounded-full transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="ml-1 text-base font-bold gold-gradient-text uppercase tracking-widest">
          {step === 1 && 'Serviços'}
          {step === 2 && 'Profissional e Horário'}
          {step === 3 && 'Confirmação'}
        </h1>
      </div>

      <div className="px-4 pb-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {step === 1 && showSuggestion && lastAppointment && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gold/10 border border-gold/20 rounded-2xl p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gold/20 flex items-center justify-center text-gold">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gold uppercase tracking-widest">Sugestão baseada no seu último serviço</p>
                <p className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                  {lastAppointment.service?.name} com {lastAppointment.barber?.users?.name?.split(' ')[0]}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleUseSuggestion}
                className="px-4 py-2 bg-gold text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gold-light transition-colors"
              >
                Usar
              </button>
              <button 
                onClick={() => setShowSuggestion(false)}
                className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map(service => {
                const isSelected = selectedServices.find(s => s.id === service.id);
                const Icon = getServiceIcon(service.name);
                return (
                  <button
                    key={service.id}
                    onClick={() => toggleService(service)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all duration-300 flex items-center gap-3 ${
                      isSelected 
                        ? 'border-gold bg-gold/10 shadow-[0_0_20px_rgba(212,175,55,0.15)]' 
                        : 'border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-white/5 hover:border-gold/20'
                    }`}
                  >
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 ${
                      isSelected ? 'bg-gold text-black scale-110' : 'bg-zinc-100 dark:bg-white/5 text-gold'
                    }`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-0.5">
                        <h3 className={`font-black text-sm uppercase tracking-tight transition-colors ${
                          isSelected ? 'text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-200'
                        }`}>
                          {service.name}
                        </h3>
                        <span className="font-black text-sm text-gold">R$ {service.price}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-zinc-400 dark:text-zinc-600" />
                          <span className="text-[9px] text-zinc-500 dark:text-zinc-500 uppercase tracking-widest font-bold">
                            Aprox. {service.duration_minutes} min
                          </span>
                        </div>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-[9px] text-gold font-black uppercase tracking-tighter animate-in fade-in slide-in-from-left-2">
                            <CheckCircle2 className="h-3 w-3" /> Selecionado
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedServices.length > 0 && (
              <div className="fixed bottom-[72px] left-0 right-0 z-50 p-4 bg-white/95 dark:bg-[#0a0502]/95 backdrop-blur-xl border-t border-zinc-200 dark:border-white/10 animate-in slide-in-from-bottom-full duration-500 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <p className="text-[9px] text-gold font-black uppercase tracking-[0.2em] mb-1">Total selecionado</p>
                    <div className="flex items-baseline gap-1">
                      <p className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter">R$ {totalPrice.toFixed(2).replace('.', ',')}</p>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase">({selectedServices.length} {selectedServices.length === 1 ? 'item' : 'itens'})</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    className="bg-gold hover:bg-gold-light text-black px-10 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-[0_0_20px_rgba(212,175,55,0.3)]"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            {/* Barber Selection */}
            <section>
              <h3 className="text-[10px] font-bold text-gold uppercase tracking-widest mb-4">Selecione o Profissional</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 hide-scrollbar md:grid md:grid-cols-4 lg:grid-cols-6 md:overflow-visible md:mx-0 md:px-0">
                <button
                  onClick={() => {
                    setSelectedBarber('any');
                    setSelectedTime(null);
                  }}
                  className={`flex-shrink-0 flex flex-col items-center gap-2 p-2 rounded-2xl border transition-all ${
                    selectedBarber === 'any' 
                      ? 'border-gold bg-gold/10 shadow-[0_0_15px_rgba(212,175,55,0.2)]' 
                      : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5'
                  }`}
                >
                  <div className={`h-16 w-16 rounded-xl overflow-hidden border-2 transition-all ${
                    selectedBarber === 'any' ? 'border-gold' : 'border-transparent'
                  }`}>
                    <img 
                      src={UNKNOWN_BARBER_IMAGE} 
                      alt="Sem preferência"
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className={`text-[11px] font-bold uppercase tracking-tight ${
                    selectedBarber === 'any' ? 'text-gold' : 'text-zinc-500 dark:text-zinc-400'
                  }`}>
                    Sem preferência
                  </span>
                </button>
                {barbers.length === 0 && (
                  <div className="flex-shrink-0 flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 w-full md:col-span-4 lg:col-span-6">
                    <p className="text-zinc-500 text-sm font-medium">Nenhum barbeiro disponível nesta unidade.</p>
                  </div>
                )}
                {barbers.map(barber => (
                  <button
                    key={barber.id}
                    onClick={() => {
                      setSelectedBarber(barber.id);
                      setSelectedTime(null);
                    }}
                    className={`flex-shrink-0 flex flex-col items-center gap-2 p-2 rounded-2xl border transition-all ${
                      selectedBarber === barber.id 
                        ? 'border-gold bg-gold/10 shadow-[0_0_15px_rgba(212,175,55,0.2)]' 
                        : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5'
                    }`}
                  >
                    <div className={`h-16 w-16 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedBarber === barber.id ? 'border-gold' : 'border-transparent'
                    }`}>
                      <img 
                        src={
                          (() => {
                            const userData = Array.isArray(barber.users) ? barber.users[0] : barber.users;
                            return userData?.avatar_url || BARBER_ILLUSTRATION;
                          })()
                        } 
                        alt={
                          (() => {
                            const userData = Array.isArray(barber.users) ? barber.users[0] : barber.users;
                            return userData?.name || 'Barbeiro';
                          })()
                        }
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = BARBER_ILLUSTRATION;
                        }}
                      />
                    </div>
                    <span className={`text-[11px] font-bold uppercase tracking-tight ${
                      selectedBarber === barber.id ? 'text-gold' : 'text-zinc-500 dark:text-zinc-400'
                    }`}>
                      {(() => {
                        const userData = Array.isArray(barber.users) ? barber.users[0] : barber.users;
                        return userData?.name?.split(' ')[0] || 'Profissional';
                      })()}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {selectedBarber && selectedBarber !== '' ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-500">
                {/* Date Selection */}
                <section>
                  <h3 className="text-[10px] font-bold text-gold uppercase tracking-widest mb-4">Data</h3>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 hide-scrollbar md:grid md:grid-cols-7 lg:grid-cols-14 md:overflow-visible md:mx-0 md:px-0">
                    {displayDates.map(date => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const isSelected = dateStr === format(selectedDate, 'yyyy-MM-dd');
                      
                      const isCalculated = slotsPerDate[dateStr] !== undefined;
                      const slotsCount = isCalculated ? slotsPerDate[dateStr].length : -1;

                      let statusColor = 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-white/20';
                      let statusText = '';

                      if (isCalculated) {
                        if (slotsCount === 0) {
                          statusText = 'Lotado';
                          statusColor = isSelected 
                            ? 'border-red-500 bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                            : 'border-red-500/20 bg-red-500/5 text-red-500/70 hover:border-red-500/40';
                        } else if (slotsCount <= 5) {
                          statusText = 'Poucos';
                          statusColor = isSelected 
                            ? 'border-yellow-500 bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]' 
                            : 'border-yellow-500/30 bg-yellow-500/5 text-yellow-500/80 hover:border-yellow-500/50';
                        } else {
                          statusText = 'Livre';
                          statusColor = isSelected 
                            ? 'border-emerald-500 bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                            : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500/80 hover:border-emerald-500/50';
                        }
                      } else if (isSelected) {
                        statusColor = 'border-gold bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]';
                      }

                      return (
                        <button
                          key={date.toISOString()}
                          onClick={() => {
                            setSelectedDate(date);
                            setSelectedTime(null);
                          }}
                          className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-[84px] rounded-2xl border transition-all ${statusColor}`}
                        >
                          <span className="text-[10px] uppercase font-bold opacity-80">{format(date, 'EEE', { locale: ptBR })}</span>
                          <span className="text-xl font-black mt-1">{format(date, 'dd')}</span>
                          {isCalculated && (
                            <span className="text-[8px] font-black uppercase mt-1 opacity-80">
                              {statusText}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {/* Botão para abrir o modal de calendário */}
                    <button 
                      onClick={() => {
                        setCalendarViewDate(startOfMonth(selectedDate));
                        setIsCalendarModalOpen(true);
                      }}
                      className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-[84px] rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-white/20 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <Calendar className="h-6 w-6 mb-1 opacity-80" />
                      <span className="text-[8px] font-black uppercase text-center leading-tight">Outras<br/>Datas</span>
                    </button>

                  </div>
                </section>

                {/* Time Selection */}
                <section>
                  <h3 className="text-[10px] font-bold text-gold uppercase tracking-widest mb-4">Horários Disponíveis</h3>
                  <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {loading ? (
                       <div className="col-span-full text-center py-6">
                         <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Calculando horários...</p>
                       </div>
                    ) : availableTimes.length === 0 ? (
                      <div className="col-span-full text-center py-6">
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Nenhum horário com tempo suficiente disponível.</p>
                      </div>
                    ) : (
                      availableTimes.map(time => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={`py-3 rounded-xl border text-center font-bold text-sm transition-all ${
                            selectedTime === time 
                              ? 'border-gold bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]' 
                              : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {time}
                        </button>
                      ))
                    )}
                  </div>
                </section>

                <button
                  disabled={!selectedTime}
                  onClick={() => setStep(3)}
                  className="btn-gold w-full disabled:opacity-50 mt-8"
                >
                  Continuar
                </button>
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-white/10 rounded-3xl">
                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Selecione um profissional para ver os horários</p>
              </div>
            )}
          </div>
        )}

        {step === 3 && selectedServices.length > 0 && selectedTime && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#1a1a1a] p-6 space-y-6 rounded-3xl border border-zinc-200 dark:border-white/5 shadow-sm">
              <div className="border-b border-zinc-200 dark:border-white/5 pb-4">
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest block mb-3">Serviços Selecionados</span>
                <div className="space-y-2">
                  {selectedServices.map(s => (
                    <div key={s.id} className="flex justify-between items-center">
                      <span className="font-bold text-zinc-700 dark:text-zinc-100 text-sm">{s.name}</span>
                      <span className="text-gold text-sm font-bold">R$ {s.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between items-center border-b border-zinc-200 dark:border-white/5 pb-4">
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Profissional</span>
                <span className="font-bold text-zinc-700 dark:text-zinc-100">
                  {selectedBarber === 'any' ? 'Sem preferência' : barbers.find(b => b.id === selectedBarber)?.users?.name || 'Profissional'}
                </span>
              </div>
              
              <div className="flex justify-between items-center border-b border-zinc-200 dark:border-white/5 pb-4">
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Data e Hora</span>
                <span className="font-bold text-zinc-700 dark:text-zinc-100">
                  {format(selectedDate, "dd/MM/yyyy")} às {selectedTime}
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-zinc-200 dark:border-white/5 pb-4">
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Duração Total</span>
                <span className="font-bold text-zinc-700 dark:text-zinc-100">{totalDuration} minutos</span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-gold font-black uppercase tracking-widest">Total a Pagar</span>
                <span className="font-black text-2xl text-gold">R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            <button
              onClick={handleBooking}
              disabled={loading}
              className="btn-gold w-full disabled:opacity-50 mt-8"
            >
              {loading ? 'Confirmando...' : 'Confirmar Reserva'}
            </button>
          </div>
        )}
      </div>

      {/* Custom Calendar Modal */}
      {isCalendarModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151515] p-6 rounded-3xl max-w-sm w-full shadow-2xl ring-1 ring-zinc-200 dark:ring-white/10 animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-white/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">Selecionar Data</h3>
              <button 
                onClick={() => setIsCalendarModalOpen(false)} 
                className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors bg-zinc-100 dark:bg-white/5 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-4 bg-zinc-50 dark:bg-white/5 rounded-2xl p-2">
              <button 
                onClick={() => setCalendarViewDate(subMonths(calendarViewDate, 1))}
                className="p-2 text-gold hover:bg-zinc-200 dark:hover:bg-white/10 rounded-xl transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="font-bold text-zinc-900 dark:text-white capitalize text-sm">
                {format(calendarViewDate, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <button 
                onClick={() => setCalendarViewDate(addMonths(calendarViewDate, 1))}
                className="p-2 text-gold hover:bg-zinc-200 dark:hover:bg-white/10 rounded-xl transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: getDay(startOfMonth(calendarViewDate)) }).map((_, i) => (
                <div key={`empty-${i}`} className="h-10 w-full" />
              ))}
              
              {eachDayOfInterval({ start: startOfMonth(calendarViewDate), end: endOfMonth(calendarViewDate) }).map(day => {
                const maxDate = addDays(startOfToday(), 60);
                const isDisabled = isBefore(day, startOfToday()) || isBefore(maxDate, day);
                const isSelected = isSameDay(day, selectedDate);

                return (
                  <button
                    key={day.toISOString()}
                    disabled={isDisabled}
                    onClick={() => {
                      setCustomDate(day);
                      setSelectedDate(day);
                      setSelectedTime(null);
                      setIsCalendarModalOpen(false);
                    }}
                    className={`
                      h-10 w-full rounded-xl flex items-center justify-center text-sm font-bold transition-all
                      ${isDisabled ? 'text-zinc-300 dark:text-zinc-700 opacity-50 cursor-not-allowed' : 
                        isSelected ? 'bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 
                        'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10'}
                    `}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 max-w-sm w-full text-center space-y-6 animate-in fade-in zoom-in duration-300 rounded-3xl border border-zinc-200 dark:border-white/5 shadow-2xl">
            <div className="mx-auto w-20 h-20 bg-gold/10 text-gold rounded-full flex items-center justify-center border border-gold/20 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-2xl font-black gold-gradient-text uppercase tracking-widest">Sucesso!</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                {searchParams.get('reschedule') 
                  ? 'Seu horário foi reagendado com sucesso.' 
                  : 'Seu horário foi agendado com sucesso.'}
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="btn-gold w-full"
            >
              Voltar para o Início
            </button>
          </div>
        </div>
      )}
    </div>
  );
}