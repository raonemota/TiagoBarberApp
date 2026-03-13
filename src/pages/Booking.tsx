import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, CheckCircle2, Scissors, Sparkles, Zap, Star, Clock } from 'lucide-react';
import { format, addDays, startOfToday, parseISO, addMinutes, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null); // null, 'any' or barber_id
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchServicesAndBarbers();
  }, []);

  useEffect(() => {
    if (selectedServices.length > 0 && selectedBarber && selectedDate) {
      calculateAvailableTimes();
    }
  }, [selectedServices, selectedBarber, selectedDate]);

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

    // Pre-select service if passed in URL
    const serviceId = searchParams.get('service');
    if (serviceId && servicesData) {
      const srv = servicesData.find(s => s.id === serviceId);
      if (srv) {
        setSelectedServices([srv]);
      }
    }

    // Pre-select barber if passed in URL
    const barberId = searchParams.get('barber');
    if (barberId) {
      setSelectedBarber(barberId);
    }
  };

  const calculateAvailableTimes = async () => {
    if (!selectedBarber || !selectedDate) return;
    setLoading(true);

    try {
      const dayOfWeek = selectedDate.getDay();
      let barberId = selectedBarber;

      // If 'any', we need to check availability for all barbers in the unit
      // For simplicity in this step, let's pick the first available barber's schedule
      if (selectedBarber === 'any') {
        barberId = barbers[0]?.id;
      }

      // 1. Fetch barber's working hours for this day
      const { data: availability } = await supabase
        .from('barber_availability')
        .select('*')
        .eq('barber_id', barberId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .single();

      if (!availability) {
        setAvailableTimes([]);
        return;
      }

      // 2. Fetch already booked appointments for this day
      const { data: bookedAppointments } = await supabase
        .from('appointments')
        .select('start_time')
        .eq('barber_id', barberId)
        .eq('date', format(selectedDate, 'yyyy-MM-dd'))
        .not('status', 'eq', 'cancelled');

      const bookedTimes = bookedAppointments?.map(a => a.start_time.substring(0, 5)) || [];

      // 2.5 Fetch blocks for this day
      const { data: blocks } = await supabase
        .from('barber_blocks')
        .select('*')
        .eq('barber_id', barberId)
        .eq('date', format(selectedDate, 'yyyy-MM-dd'));

      // 3. Generate slots between start_time and end_time
      const slots = [];
      let current = availability.start_time.substring(0, 5);
      const end = availability.end_time.substring(0, 5);

      while (current < end) {
        const isBooked = bookedTimes.includes(current);
        
        // Check if current slot is blocked
        const isBlocked = blocks?.some(block => {
          if (!block.start_time) return true; // Full day block
          return current >= block.start_time.substring(0, 5) && current < block.end_time.substring(0, 5);
        });

        if (!isBooked && !isBlocked) {
          slots.push(current);
        }
        
        // Add 30 minutes
        const [hours, minutes] = current.split(':').map(Number);
        let nextMinutes = minutes + 30;
        let nextHours = hours;
        if (nextMinutes >= 60) {
          nextHours++;
          nextMinutes = 0;
        }
        current = `${nextHours.toString().padStart(2, '0')}:${nextMinutes.toString().padStart(2, '0')}`;
      }

      setAvailableTimes(slots);
    } catch (error) {
      console.error('Error calculating times:', error);
      setAvailableTimes([]);
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

  const handleBooking = async () => {
    if (selectedServices.length === 0 || !selectedTime || !profile) return;
    setLoading(true);

    try {
      let barberId = selectedBarber;
      if (selectedBarber === 'any') {
        // Pick a random barber from the available ones if 'any' is selected
        const randomIndex = Math.floor(Math.random() * barbers.length);
        barberId = barbers[randomIndex]?.id;
      }

      if (!barberId) {
        throw new Error('Nenhum barbeiro disponível para esta unidade.');
      }

      const unitId = searchParams.get('unit');
      const rescheduleId = searchParams.get('reschedule');

      const totalDuration = selectedServices.reduce((acc, s) => acc + s.duration_minutes, 0);
      const startTimeDate = parse(selectedTime, 'HH:mm', new Date());
      const endTimeDate = addMinutes(startTimeDate, totalDuration);
      const endTime = format(endTimeDate, 'HH:mm');

      const totalPrice = selectedServices.reduce((acc, s) => acc + s.price, 0);

      const appointmentData = {
        client_id: profile.id,
        barber_id: barberId,
        service_id: selectedServices[0].id,
        unit_id: unitId,
        date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: selectedTime,
        end_time: endTime,
        status: 'scheduled',
        notes: `Serviços: ${selectedServices.map(s => s.name).join(', ')} | Total: R$ ${totalPrice.toFixed(2)}${rescheduleId ? ' (Reagendamento)' : ''}`
      };

      let result;
      if (rescheduleId) {
        result = await supabase
          .from('appointments')
          .update(appointmentData)
          .eq('id', rescheduleId);
      } else {
        result = await supabase
          .from('appointments')
          .insert([appointmentData]);
      }

      if (result.error) throw result.error;
      setShowModal(true);
    } catch (error) {
      console.error('Error booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const dates = Array.from({ length: 14 }).map((_, i) => addDays(startOfToday(), i));

  return (
    <div className="mx-auto max-w-lg md:max-w-4xl lg:max-w-6xl bg-[#0a0502] min-h-screen pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0502]/95 backdrop-blur-md px-4 py-2 border-b border-white/5 flex items-center -mx-4 mb-4">
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate('/')} className="p-2 text-gold hover:bg-white/5 rounded-full transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="ml-1 text-base font-bold gold-gradient-text uppercase tracking-widest">
          {step === 1 && 'Serviços'}
          {step === 2 && 'Profissional e Horário'}
          {step === 3 && 'Confirmação'}
        </h1>
      </div>

      <div className="px-4 pb-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                        : 'border-white/5 bg-white/5 hover:border-gold/20'
                    }`}
                  >
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 ${
                      isSelected ? 'bg-gold text-black scale-110' : 'bg-white/5 text-gold'
                    }`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-0.5">
                        <h3 className={`font-black text-sm uppercase tracking-tight transition-colors ${
                          isSelected ? 'text-white' : 'text-zinc-200'
                        }`}>
                          {service.name}
                        </h3>
                        <span className="font-black text-sm text-gold">R$ {service.price}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-zinc-600" />
                          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">
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
              <div className="fixed bottom-[72px] left-0 right-0 z-50 p-4 bg-[#0a0502]/95 backdrop-blur-xl border-t border-white/10 animate-in slide-in-from-bottom-full duration-500 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <p className="text-[9px] text-gold font-black uppercase tracking-[0.2em] mb-1">Total selecionado</p>
                    <div className="flex items-baseline gap-1">
                      <p className="text-2xl font-black text-white tracking-tighter">R$ {totalPrice.toFixed(2).replace('.', ',')}</p>
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
                      : 'border-white/10 bg-white/5'
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
                    selectedBarber === 'any' ? 'text-gold' : 'text-zinc-400'
                  }`}>
                    Sem preferência
                  </span>
                </button>
                {barbers.length === 0 && (
                  <div className="flex-shrink-0 flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-white/10 bg-white/5 w-full md:col-span-4 lg:col-span-6">
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
                        : 'border-white/10 bg-white/5'
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
                      selectedBarber === barber.id ? 'text-gold' : 'text-zinc-400'
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
                    {dates.map(date => {
                      const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                      return (
                        <button
                          key={date.toISOString()}
                          onClick={() => {
                            setSelectedDate(date);
                            setSelectedTime(null);
                          }}
                          className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-2xl border transition-all ${
                            isSelected 
                              ? 'border-gold bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]' 
                              : 'border-white/10 bg-white/5 text-zinc-400'
                          }`}
                        >
                          <span className="text-[10px] uppercase font-bold opacity-80">{format(date, 'EEE', { locale: ptBR })}</span>
                          <span className="text-xl font-black mt-1">{format(date, 'dd')}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Time Selection */}
                <section>
                  <h3 className="text-[10px] font-bold text-gold uppercase tracking-widest mb-4">Horários Disponíveis</h3>
                  <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {availableTimes.map(time => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`py-3 rounded-xl border text-center font-bold text-sm transition-all ${
                          selectedTime === time 
                            ? 'border-gold bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]' 
                            : 'border-white/10 bg-white/5 text-zinc-400'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
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
              <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl">
                <p className="text-zinc-500 text-sm font-medium">Selecione um profissional para ver os horários</p>
              </div>
            )}
          </div>
        )}

        {step === 3 && selectedServices.length > 0 && selectedTime && (
          <div className="space-y-6">
            <div className="dark-card p-6 space-y-6">
              <div className="border-b border-white/5 pb-4">
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest block mb-3">Serviços Selecionados</span>
                <div className="space-y-2">
                  {selectedServices.map(s => (
                    <div key={s.id} className="flex justify-between items-center">
                      <span className="font-bold text-zinc-100 text-sm">{s.name}</span>
                      <span className="text-gold text-sm font-bold">R$ {s.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Profissional</span>
                <span className="font-bold text-zinc-100">
                  {selectedBarber === 'any' ? 'Sem preferência' : barbers.find(b => b.id === selectedBarber)?.users?.name || 'Profissional'}
                </span>
              </div>
              
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Data e Hora</span>
                <span className="font-bold text-zinc-100">
                  {format(selectedDate, "dd/MM/yyyy")} às {selectedTime}
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Duração Total</span>
                <span className="font-bold text-zinc-100">{totalDuration} minutos</span>
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

      {/* Success Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="dark-card p-8 max-w-sm w-full text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="mx-auto w-20 h-20 bg-gold/10 text-gold rounded-full flex items-center justify-center border border-gold/20 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-2xl font-black gold-gradient-text uppercase tracking-widest">Sucesso!</h3>
              <p className="text-zinc-500 mt-2 font-medium">
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
