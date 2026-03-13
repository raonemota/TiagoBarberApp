import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { supabase } from '../lib/supabase';
import { MapPin, ChevronLeft, ExternalLink, Clock, Phone, Globe } from 'lucide-react';
import { motion } from 'motion/react';

interface Unit {
  id: string;
  name: string;
  address: string;
  google_maps_link: string;
}

export default function UnitDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchUnitDetails();
    }
  }, [id]);

  const fetchUnitDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setUnit(data);
    } catch (error) {
      console.error('Error fetching unit details:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent"></div>
      </div>
    );
  }

  if (!unit) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Detalhes da Unidade</h1>
      </div>

      {/* Main Card */}
      <div className="dark-card overflow-hidden">
        <div className="h-48 bg-gradient-to-br from-gold/20 to-amber-900/20 relative flex items-center justify-center">
          <MapPin className="h-20 w-20 text-gold/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] to-transparent" />
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2">{unit.name}</h2>
            <div className="flex items-start gap-3 text-zinc-400">
              <MapPin className="h-5 w-5 text-gold shrink-0 mt-0.5" />
              <p className="text-sm font-medium leading-relaxed">{unit.address}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {unit.google_maps_link && (
              <a 
                href={unit.google_maps_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 rounded-2xl bg-gold/10 border border-gold/20 group hover:bg-gold/20 transition-all"
              >
                <div className="flex items-center gap-3 text-gold">
                  <Globe className="h-5 w-5" />
                  <span className="font-bold text-sm uppercase tracking-widest">Ver no Google Maps</span>
                </div>
                <ExternalLink className="h-5 w-5 text-gold group-hover:translate-x-1 transition-transform" />
              </a>
            )}

            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
              <div className="flex items-center gap-3 text-zinc-300">
                <Clock className="h-5 w-5 text-gold" />
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Horário de Funcionamento</p>
                  <p className="text-sm font-bold">Segunda a Sábado: 09:00 - 20:00</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-zinc-300">
                <Phone className="h-5 w-5 text-gold" />
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Contato</p>
                  <p className="text-sm font-bold">(11) 99999-9999</p>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => navigate(`/booking?unit=${unit.id}`)}
            className="w-full py-4 bg-gold text-black rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-gold-light transition-all shadow-lg shadow-gold/20"
          >
            Agendar nesta unidade
          </button>
        </div>
      </div>
    </div>
  );
}
