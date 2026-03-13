import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Scissors, Calendar, Clock, User as UserIcon, ChevronRight, Plus, MapPin, Sparkles, Zap, Star, Settings2, X, Trash2, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useNotification } from '../contexts/NotificationContext';

interface Appointment {
  id: string;
  date: string;
  start_time: string;
  end_time?: string;
  notes?: string;
  service: { id: string; name: string };
  barber: { id: string; users: { name: string; avatar_url?: string | null } };
}

interface Service {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface Barber {
  id: string;
  users: any;
}

const BARBER_ILLUSTRATION = "https://zuwdcmdcrofvfexmbilg.supabase.co/storage/v1/object/public/config/barber-illustration.png"; // Placeholder illustration

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

const BANNERS = [
  {
    id: 1,
    title: "Barboterapia",
    description: "Por +R$10 adicione ao seu corte",
    icon: Sparkles,
    color: "from-amber-500/20 to-gold/20"
  },
  {
    id: 2,
    title: "Clube Tiago Barber",
    description: "Você já conhece nosso plano de assinatura?",
    icon: Star,
    color: "from-gold/20 to-amber-600/20"
  }
];

interface Unit {
  id: string;
  name: string;
  address: string;
  google_maps_link: string;
}

export default function ClientHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [futureAppointments, setFutureAppointments] = useState<Appointment[]>([]);
  const [featuredServices, setFeaturedServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (profile) {
      if (profile.role === 'admin') {
        navigate('/admin');
        return;
      }
      if (profile.role === 'barber') {
        navigate('/barber');
        return;
      }
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch units first
      const { data: unitsData } = await supabase
        .from('units')
        .select('*')
        .order('name', { ascending: true });

      if (unitsData) {
        setUnits(unitsData);
        
        const savedUnitId = localStorage.getItem('selected_unit_id');
        const savedUnit = unitsData.find(u => u.id === savedUnitId);
        
        if (unitsData.length === 1) {
          setSelectedUnit(unitsData[0]);
        } else if (savedUnit) {
          setSelectedUnit(savedUnit);
        } else {
          setIsUnitModalOpen(true);
        }
      }

      // Fetch future appointments
      const { data: futureData } = await supabase
        .from('appointments')
        .select(`
          id, date, start_time, end_time, notes,
          service:services(name),
          barber:barbers(users:user_id(name, avatar_url))
        `)
        .eq('client_id', profile?.id)
        .gte('date', today)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (futureData) setFutureAppointments(futureData as any);

      // Fetch some services to show
      const { data: servicesData } = await supabase
        .from('services')
        .select('*')
        .limit(3);

      if (servicesData) setFeaturedServices(servicesData);

      // Fetch barbers
      const { data: barbersData } = await supabase
        .from('barbers')
        .select(`
          id,
          specialties,
          users:user_id (
            name,
            avatar_url
          )
        `);

      if (barbersData) setBarbers(barbersData as any);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUnit = (unit: Unit) => {
    setSelectedUnit(unit);
    localStorage.setItem('selected_unit_id', unit.id);
    setIsUnitModalOpen(false);
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
      fetchDashboardData();
    } catch (error: any) {
      showNotification(error.message, 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = (apt: Appointment) => {
    const unitId = (apt as any).unit_id;
    const serviceId = (apt as any).service_id || (apt.service as any)?.id;
    const barberId = (apt as any).barber_id || (apt.barber as any)?.id;
    
    let url = `/booking?reschedule=${apt.id}`;
    if (unitId) url += `&unit=${unitId}`;
    if (serviceId) url += `&service=${serviceId}`;
    if (barberId) url += `&barber=${barberId}`;
    
    navigate(url);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-12 rounded-xl bg-white/5"></div>
        <div className="h-40 rounded-2xl bg-white/5"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-white/5"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Location Selector - Ultra Minimalist */}
      <div 
        onClick={() => selectedUnit && navigate(`/unit/${selectedUnit.id}`)}
        className="flex items-center justify-center gap-2 mx-auto w-fit cursor-pointer group"
      >
        <MapPin className="h-3 w-3 text-gold/60 group-hover:text-gold transition-colors" />
        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] group-hover:text-white transition-colors">
          {selectedUnit ? selectedUnit.name : 'Selecione uma unidade'}
        </span>
        {units.length > 1 && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsUnitModalOpen(true);
            }}
            className="hover:text-gold transition-colors text-zinc-600"
          >
            <Settings2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Promotional Banners */}
      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar snap-x md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible">
        {BANNERS.map((banner) => (
          <motion.div
            key={banner.id}
            whileTap={{ scale: 0.98 }}
            className={`flex-shrink-0 w-[280px] md:w-full snap-center rounded-2xl p-4 bg-gradient-to-br ${banner.color} border border-gold/10 flex items-center gap-4`}
          >
            <div className="h-10 w-10 rounded-full bg-gold/20 flex items-center justify-center text-gold">
              <banner.icon className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-tight">{banner.title}</h4>
              <p className="text-[10px] text-zinc-400 font-medium leading-tight mt-0.5">{banner.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* New Appointment Button - Creative */}
      <button 
        onClick={() => navigate(`/booking${selectedUnit ? `?unit=${selectedUnit.id}` : ''}`)}
        className="group relative w-full overflow-hidden rounded-2xl p-[1px] transition-all active:scale-[0.98]"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-gold/50 via-gold-light to-gold/50 animate-gradient-x"></div>
        <div className="relative flex items-center justify-between bg-[#0a0502] rounded-[15px] p-6">
          <div className="flex flex-col items-start text-left">
            <span className="text-xs font-bold text-gold uppercase tracking-widest mb-1">Agende agora</span>
            <span className="text-xl font-black text-white uppercase tracking-tighter">Novo Horário</span>
          </div>
          <div className="h-12 w-12 rounded-full bg-gold flex items-center justify-center text-black shadow-[0_0_20px_rgba(212,175,55,0.4)] group-hover:scale-110 transition-transform">
            <Plus className="h-6 w-6 stroke-[3px]" />
          </div>
        </div>
      </button>

      {/* Future Appointments */}
      {futureAppointments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-[10px] font-bold text-gold uppercase tracking-widest">Seus Agendamentos</h3>
            <span className="h-[1px] flex-1 bg-white/5 mx-4"></span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {futureAppointments.map((apt) => (
              <div 
                key={apt.id} 
                onClick={() => setSelectedAppointment(apt)}
                className="dark-card p-5 flex flex-col gap-4 cursor-pointer hover:border-gold/30 transition-all"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gold" />
                    <span className="font-bold capitalize text-[11px] tracking-wide text-zinc-300">
                      {format(parseISO(apt.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-black text-gold text-sm">
                    <Clock className="h-4 w-4" />
                    {apt.start_time.substring(0, 5)}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-lg uppercase tracking-tight text-white">
                      {apt.notes?.startsWith('Serviços:') 
                        ? apt.notes.split('|')[0].replace('Serviços:', '').trim()
                        : apt.service?.name || 'Serviço'}
                    </p>
                    <p className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-1 uppercase tracking-widest font-bold">
                      <UserIcon className="h-3 w-3 text-gold" />
                      {apt.barber?.users?.name || 'Profissional'}
                    </p>
                  </div>
                  <button className="p-2 rounded-lg bg-white/5 text-gold hover:bg-gold/10 transition-colors">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Barbers Section */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-[10px] font-bold text-gold uppercase tracking-widest">Nossos Barbeiros</h3>
          <span className="h-[1px] flex-1 bg-white/5 mx-4"></span>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar snap-x px-2 md:grid md:grid-cols-3 lg:grid-cols-4 md:overflow-visible">
          {barbers.map((barber) => {
            const userData = Array.isArray(barber.users) ? barber.users[0] : barber.users;
            return (
              <motion.div
                key={barber.id}
                whileHover={{ y: -4 }}
                className="flex-shrink-0 w-[180px] md:w-full snap-center bg-[#1a1a1a] rounded-2xl overflow-hidden border border-white/5 shadow-2xl group"
              >
                <div className="relative h-32 overflow-hidden">
                  <img 
                    src={userData?.avatar_url || BARBER_ILLUSTRATION} 
                    alt={userData?.name || 'Barbeiro'}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = BARBER_ILLUSTRATION;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3">
                    <p className="text-[8px] font-bold text-gold uppercase tracking-widest mb-0.5">Profissional</p>
                    <h4 className="text-sm font-black text-white uppercase tracking-tighter leading-none">
                      {userData?.name?.split(' ')[0] || 'Barbeiro'}
                    </h4>
                  </div>
                </div>
                
                <div className="p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 bg-gold/10 rounded-lg shrink-0">
                      <Scissors className="h-3 w-3 text-gold" />
                    </div>
                    <div>
                      <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Especialidades</p>
                      <p className="text-[10px] text-zinc-300 font-medium line-clamp-1">
                        {(barber as any).specialties || 'Corte & Barba'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/booking?barber=${barber.id}`)}
                    className="w-full py-2.5 bg-white text-black rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-gold hover:text-white transition-all duration-300 flex items-center justify-center gap-1.5"
                  >
                    Agendar
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Services Section */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-[10px] font-bold text-gold uppercase tracking-widest">Serviços Populares</h3>
          <span className="h-[1px] flex-1 bg-white/5 mx-4"></span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredServices.map((service) => {
            const Icon = getServiceIcon(service.name);
            return (
              <button
                key={service.id}
                onClick={() => navigate(`/booking?service=${service.id}${selectedUnit ? `&unit=${selectedUnit.id}` : ''}`)}
                className="w-full dark-card p-3 flex items-center gap-3 group hover:border-gold/30 transition-all duration-300"
              >
                <div className="h-12 w-12 rounded-xl bg-gold/5 flex items-center justify-center text-gold group-hover:scale-110 transition-transform duration-300 border border-gold/10 shrink-0">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex justify-between items-center mb-0.5">
                    <p className="font-black text-sm text-white uppercase tracking-tight">{service.name}</p>
                    <p className="font-black text-sm text-gold">R$ {service.price.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-zinc-600" />
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                      Aprox. {service.duration_minutes} min
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-gold transition-colors" />
              </button>
            );
          })}
        </div>
        
        <button 
          onClick={() => navigate(`/booking${selectedUnit ? `?unit=${selectedUnit.id}` : ''}`)}
          className="w-full mt-6 py-4 rounded-xl border border-white/5 text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-white/5 hover:text-zinc-300 transition-all"
        >
          Ver todos os serviços <ChevronRight className="h-3 w-3" />
        </button>
      </section>

      {/* Unit Selection Modal */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
          <div className="w-full max-w-sm space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex p-4 rounded-full bg-gold/10 text-gold mb-4">
                <MapPin className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Escolha a Unidade</h2>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Selecione onde deseja ser atendido</p>
            </div>

            <div className="space-y-4">
              {units.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => handleSelectUnit(unit)}
                  className={`w-full p-6 rounded-2xl border transition-all text-left flex items-center justify-between group ${
                    selectedUnit?.id === unit.id 
                      ? 'bg-gold/10 border-gold/50' 
                      : 'bg-white/5 border-white/5 hover:border-gold/30'
                  }`}
                >
                  <div>
                    <h3 className="font-black text-white uppercase tracking-tight group-hover:text-gold transition-colors">{unit.name}</h3>
                  </div>
                  <ChevronRight className={`h-5 w-5 ${selectedUnit?.id === unit.id ? 'text-gold' : 'text-zinc-700'}`} />
                </button>
              ))}
            </div>
            
            {selectedUnit && (
              <button 
                onClick={() => setIsUnitModalOpen(false)}
                className="w-full py-4 text-zinc-500 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      )}

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
                      : 'R$ --'}
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
