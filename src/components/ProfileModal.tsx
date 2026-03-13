import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { X, Camera, Loader2, User as UserIcon } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { profile, user } = useAuth();
  const { showNotification } = useNotification();
  const [name, setName] = useState(profile?.name || '');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ name })
        .eq('id', user.id);

      if (error) throw error;
      showNotification('Perfil atualizado com sucesso!');
      onClose();
      window.location.reload(); // Recarrega para atualizar o contexto global
    } catch (error) {
      showNotification('Erro ao atualizar perfil', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0 || !user) return;

      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Math.random()}.${fileExt}`;

      // 1. Upload da imagem
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Atualizar tabela users
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      showNotification('Foto atualizada!');
      window.location.reload();
    } catch (error) {
      console.error('Erro no upload:', error);
      showNotification('Erro ao fazer upload da imagem', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300 ring-1 ring-[#262626]">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold text-white tracking-tighter">Editar Perfil</h3>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-[#262626] rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="relative group">
            <div className="h-24 w-24 rounded-full bg-[#262626] overflow-hidden ring-4 ring-[#1a1a1a] flex items-center justify-center">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="h-12 w-12 text-zinc-500" />
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#8162ff]" />
                </div>
              )}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 bg-[#8162ff] text-white rounded-full shadow-lg hover:scale-110 transition-transform"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleUploadAvatar} 
              className="hidden" 
              accept="image/*" 
            />
          </div>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Clique na câmera para mudar a foto</p>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Seu Nome</label>
            <input 
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white focus:ring-2 focus:ring-[#8162ff]"
            />
          </div>

          <button 
            type="submit"
            disabled={loading || uploading}
            className="w-full py-4 bg-[#8162ff] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#6e4ff0] disabled:opacity-50 transition-all shadow-lg shadow-[#8162ff]/20"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar Alterações'}
          </button>
        </form>
      </div>
    </div>
  );
}
