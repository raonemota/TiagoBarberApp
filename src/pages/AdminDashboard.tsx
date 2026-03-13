import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ImageCropper from '../components/ImageCropper';
import { useNotification } from '../contexts/NotificationContext';
import { 
  Users, Scissors, Package, Settings, X, Plus, Loader2, 
  Mail, Phone, Shield, UserCheck, Search, ChevronDown,
  Trash2, Edit3, DollarSign, Clock, Briefcase, UserPlus,
  MapPin
} from 'lucide-react';

interface UserList {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  subscription_type: string;
}

interface Unit {
  id: string;
  name: string;
  address: string;
  google_maps_link: string;
}

const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(-\d{4})(\d+?)$/, "$1");
};

const BARBER_ILLUSTRATION = "https://zuwdcmdcrofvfexmbilg.supabase.co/storage/v1/object/public/config/barber-illustration.png";

export default function AdminDashboard() {
  const { showNotification } = useNotification();
  const [stats, setStats] = useState({ users: 0, barbers: 0, services: 0, products: 0, units: 0 });
  const [allUsers, setAllUsers] = useState<UserList[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [barbersList, setBarbersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isBarberModalOpen, setIsBarberModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Cropper states
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropType, setCropType] = useState<'barber' | 'user' | null>(null);

  // Form states
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [barberAvatar, setBarberAvatar] = useState<File | null>(null);
  const [editingBarberId, setEditingBarberId] = useState<string | null>(null);
  
  const [editingUser, setEditingUser] = useState<UserList | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editSubscription, setEditSubscription] = useState('');
  const [editAvatar, setEditAvatar] = useState<File | null>(null);
  
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [serviceName, setServiceName] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceDuration, setServiceDuration] = useState('30');

  const [unitName, setUnitName] = useState('');
  const [unitAddress, setUnitAddress] = useState('');
  const [unitMapsLink, setUnitMapsLink] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [{ count: usersCount }, { count: barbersCount }, { count: servicesCount }, { count: productsCount }, { count: unitsCount }] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('barbers').select('*', { count: 'exact', head: true }),
        supabase.from('services').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('units').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        users: usersCount || 0,
        barbers: barbersCount || 0,
        services: servicesCount || 0,
        products: productsCount || 0,
        units: unitsCount || 0,
      });

      // Fetch all users for the list and selection
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });
        
      if (usersData) setAllUsers(usersData);

      // Fetch units
      const { data: unitsData } = await supabase
        .from('units')
        .select('*')
        .order('name', { ascending: true });
      
      if (unitsData) setUnits(unitsData);

      // Fetch barbers with unit info
      const { data: barbersListData } = await supabase
        .from('barbers')
        .select('*, users:user_id(*), units:unit_id(*)')
        .order('id', { ascending: true });
        
      if (barbersListData) setBarbersList(barbersListData);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'barber' | 'user') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setCropType(type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });
    if (cropType === 'barber') {
      setBarberAvatar(file);
    } else if (cropType === 'user') {
      setEditAvatar(file);
    }
    setImageToCrop(null);
    setCropType(null);
  };

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from('units').insert({
        name: unitName,
        address: unitAddress,
        google_maps_link: unitMapsLink
      });

      if (error) throw error;

      setIsUnitModalOpen(false);
      setUnitName('');
      setUnitAddress('');
      setUnitMapsLink('');
      fetchAdminData();
      showNotification('Unidade cadastrada com sucesso!');
    } catch (error: any) {
      console.error('Error creating unit:', error);
      showNotification(error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta unidade?')) return;
    
    try {
      const { error } = await supabase.from('units').delete().eq('id', id);
      if (error) throw error;
      fetchAdminData();
    } catch (error: any) {
      console.error('Error deleting unit:', error);
      showNotification(error.message, 'error');
    }
  };

  const handleCreateBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setSubmitting(true);
    try {
      let avatarUrl = '';
      
      // Handle avatar upload if selected
      if (barberAvatar) {
        setUploading(true);
        const fileExt = barberAvatar.name.split('.').pop();
        const fileName = `${selectedUserId}-${Math.random()}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, barberAvatar);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
          
        avatarUrl = publicUrl;
      }

      if (editingBarberId) {
        // Update existing barber
        const updates: any = {
          unit_id: selectedUnitId || null,
          specialties: specialties
        };

        const { error: updateError } = await supabase
          .from('barbers')
          .update(updates)
          .eq('id', editingBarberId);

        if (updateError) throw updateError;

        // Update user avatar if changed
        if (avatarUrl) {
          await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', selectedUserId);
        }

        showNotification('Profissional atualizado com sucesso!');
      } else {
        // Create new barber via proxy
        const response = await fetch('/api/admin/promote-barber', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            userId: selectedUserId, 
            specialties,
            avatarUrl,
            unitId: selectedUnitId
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Promotion error details:', errorData);
          let errorMessage = errorData.message || errorData.details || 'Erro ao cadastrar profissional via servidor.';
          if (errorData.hint) {
            errorMessage += `\n\nDica: ${errorData.hint}`;
          }
          throw new Error(errorMessage);
        }
        showNotification('Profissional cadastrado com sucesso!');
      }

      setIsBarberModalOpen(false);
      setSelectedUserId('');
      setSelectedUnitId('');
      setSpecialties('');
      setBarberAvatar(null);
      setEditingBarberId(null);
      fetchAdminData();
    } catch (error: any) {
      console.error('Error promoting/updating barber:', error);
      showNotification(error.message, 'error');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          phone: newPhone,
          password: newPassword,
          role: 'client',
          subscription_type: 'comum'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao criar cliente.');
      }

      setIsUserModalOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
      fetchAdminData();
      showNotification('Cliente criado com sucesso!');
    } catch (error: any) {
      console.error('Error creating user:', error);
      showNotification(error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = (user: UserList) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditPhone(user.phone || '');
    setEditRole(user.role || 'client');
    setEditSubscription(user.subscription_type || 'comum');
    setEditAvatar(null);
    setIsUserEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);
    try {
      let avatarUrl = (editingUser as any).avatar_url;

      if (editAvatar) {
        setUploading(true);
        const fileExt = editAvatar.name.split('.').pop();
        const fileName = `${editingUser.id}-${Math.random()}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, editAvatar);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
          
        avatarUrl = publicUrl;
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          phone: editPhone,
          role: editRole,
          subscription_type: editSubscription,
          avatar_url: avatarUrl
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Update error details:', errorData);
        let errorMessage = errorData.message || errorData.details || 'Erro ao atualizar usuário.';
        if (errorData.hint) {
          errorMessage += `\n\nDica: ${errorData.hint}`;
        }
        throw new Error(errorMessage);
      }

      setIsUserEditModalOpen(false);
      fetchAdminData();
      showNotification('Usuário atualizado com sucesso!');
    } catch (error: any) {
      console.error('Error updating user:', error);
      showNotification(error.message, 'error');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const handleDeleteUser = (userId: string) => {
    setUserToDelete(userId);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/users/${userToDelete}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Delete error details:', errorData);
        let errorMessage = errorData.message || errorData.details || 'Erro ao excluir usuário.';
        if (errorData.hint) {
          errorMessage += `\n\nDica: ${errorData.hint}`;
        }
        throw new Error(errorMessage);
      }

      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      fetchAdminData();
    } catch (error: any) {
      console.error('Error deleting user:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Check session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada ou usuário não autenticado. Por favor, faça login novamente.');
      }

      const price = parseFloat(servicePrice);
      const duration = parseInt(serviceDuration);

      if (isNaN(price) || isNaN(duration)) {
        throw new Error('Preço ou duração inválidos. Certifique-se de usar números.');
      }

      console.log('Attempting to create service via proxy:', { 
        name: serviceName, 
        description: serviceDescription,
        price, 
        duration_minutes: duration 
      });

      const response = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: serviceName, 
          description: serviceDescription,
          price: price, 
          duration_minutes: duration 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Proxy error response:', errorData);
        throw new Error(errorData.message || errorData.details || 'Erro ao cadastrar serviço via servidor.');
      }

      const data = await response.json();
      console.log('Service created successfully via proxy:', data);
      
      setIsServiceModalOpen(false);
      setServiceName('');
      setServiceDescription('');
      setServicePrice('');
      fetchAdminData();
    } catch (error: any) {
      console.error('Detailed error creating service:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredClients = allUsers.filter(u => 
    u.role === 'client' && (
      (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
      (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )
  );

  const filteredAdmins = allUsers.filter(u => 
    u.role === 'admin' && (
      (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
      (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )
  );

  const combinedBarbers = allUsers
    .filter(u => u.role === 'barber')
    .map(u => {
      const barberData = barbersList.find(b => b.user_id === u.id);
      return {
        user: u,
        barber: barberData,
        id: barberData?.id || `pending-${u.id}`
      };
    });

  if (loading && allUsers.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter text-white">Administração</h1>
          <p className="text-zinc-500">Gerencie clientes, profissionais e serviços da sua barbearia.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsUnitModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-white shadow-sm ring-1 ring-[#262626] hover:bg-[#262626] transition-colors"
          >
            <MapPin className="h-5 w-5 text-[#8162ff]" /> Nova Unidade
          </button>
          <button 
            onClick={() => setIsUserModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-white shadow-sm ring-1 ring-[#262626] hover:bg-[#262626] transition-colors"
          >
            <Plus className="h-5 w-5 text-[#8162ff]" /> Novo Cliente
          </button>
          <button 
            onClick={() => setIsServiceModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-white shadow-sm ring-1 ring-[#262626] hover:bg-[#262626] transition-colors"
          >
            <Plus className="h-5 w-5 text-[#8162ff]" /> Novo Serviço
          </button>
          <button 
            onClick={() => setIsBarberModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#8162ff] px-3 py-2 text-xs font-bold text-white shadow-lg hover:bg-[#6e4ff0] transition-colors"
          >
            <UserCheck className="h-5 w-5" /> Novo Barbeiro
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { name: 'Clientes', value: stats.users, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { name: 'Barbeiros', value: stats.barbers, icon: Briefcase, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { name: 'Serviços', value: stats.services, icon: Scissors, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { name: 'Produtos', value: stats.products, icon: Package, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { name: 'Unidades', value: stats.units, icon: MapPin, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map((card) => (
          <div key={card.name} className="relative overflow-hidden rounded-2xl bg-[#1a1a1a] p-6 shadow-sm ring-1 ring-[#262626]">
            <div className={`inline-flex rounded-xl p-3 ${card.bg} ${card.color} mb-4`}>
              <card.icon className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{card.name}</p>
            <p className="mt-1 text-3xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Users Management Section */}
      <div className="rounded-3xl bg-[#1a1a1a] shadow-sm ring-1 ring-[#262626] overflow-hidden">
        <div className="border-b border-[#262626] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-[#8162ff]" />
              Gestão de Clientes
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Buscar por nome ou email..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border-none bg-[#262626] pl-10 text-sm text-white placeholder-zinc-500 focus:ring-2 focus:ring-[#8162ff]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#262626]/50 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Assinatura</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {filteredClients.map((user) => (
                <tr key={user.id} className="hover:bg-[#262626]/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-[#262626] flex items-center justify-center text-white font-bold ring-1 ring-[#333]">
                        {user.name?.charAt(0) || '?'}
                      </div>
                      <span className="font-bold text-white">{user.name || 'Sem Nome'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Mail className="h-3.5 w-3.5 text-[#8162ff]" /> {user.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Phone className="h-3.5 w-3.5 text-[#8162ff]" /> {user.phone || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold uppercase ${user.subscription_type === 'clube' ? 'text-amber-500' : 'text-zinc-600'}`}>
                      {user.subscription_type === 'clube' ? '★ Assinante Clube' : 'Comum'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditUser(user)}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-[#262626] rounded-lg transition-colors"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setUserToDelete(user.id);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admins Management Section */}
      {filteredAdmins.length > 0 && (
        <div className="rounded-3xl bg-[#1a1a1a] shadow-sm ring-1 ring-[#262626] overflow-hidden">
          <div className="border-b border-[#262626] p-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-500" />
              Gestão de Administradores
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#262626]/50 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <th className="px-6 py-4">Administrador</th>
                  <th className="px-6 py-4">Contato</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626]">
                {filteredAdmins.map((user) => (
                  <tr key={user.id} className="hover:bg-[#262626]/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold ring-1 ring-purple-500/20">
                          {user.name?.charAt(0) || '?'}
                        </div>
                        <span className="font-bold text-white">{user.name || 'Sem Nome'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <Mail className="h-3.5 w-3.5 text-purple-500" /> {user.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEditUser(user)}
                          className="p-2 text-zinc-500 hover:text-white hover:bg-[#262626] rounded-lg transition-colors"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Barbers Management Section */}
      <div className="rounded-3xl bg-[#1a1a1a] shadow-sm ring-1 ring-[#262626] overflow-hidden">
        <div className="border-b border-[#262626] p-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-[#8162ff]" />
            Gestão de Barbeiros
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#262626]/50 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <th className="px-6 py-4">Barbeiro</th>
                <th className="px-6 py-4">Unidade</th>
                <th className="px-6 py-4">Especialidades</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {combinedBarbers.map((item) => (
                <tr key={item.id} className="hover:bg-[#262626]/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-[#262626] overflow-hidden ring-1 ring-[#333]">
                        <img 
                          src={item.user.avatar_url || BARBER_ILLUSTRATION} 
                          alt={item.user.name}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="font-bold text-white">{item.user.name || 'Sem Nome'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <MapPin className="h-4 w-4 text-[#8162ff]" />
                      <span className="text-sm">{item.barber?.units?.name || 'Não atribuída'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-zinc-500">{item.barber?.specialties || 'Nenhuma'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {item.barber ? (
                        <button 
                          onClick={() => {
                            setSelectedUserId(item.user.id);
                            setSelectedUnitId(item.barber.unit_id || '');
                            setSpecialties(item.barber.specialties || '');
                            setEditingBarberId(item.barber.id);
                            setIsBarberModalOpen(true);
                          }}
                          className="p-2 text-zinc-500 hover:text-gold hover:bg-gold/10 rounded-lg transition-colors"
                          title="Editar Barbeiro"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            setSelectedUserId(item.user.id);
                            setEditingBarberId(null);
                            setIsBarberModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg text-xs font-bold hover:bg-amber-500/20 transition-colors"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Completar
                        </button>
                      )}
                      <button 
                        onClick={async () => {
                          if (confirm('Deseja remover este barbeiro? O usuário voltará a ser cliente.')) {
                            try {
                              if (item.barber) {
                                const { error } = await supabase.from('barbers').delete().eq('id', item.barber.id);
                                if (error) throw error;
                              }
                              await supabase.from('users').update({ role: 'client' }).eq('id', item.user.id);
                              fetchAdminData();
                              showNotification('Profissional removido com sucesso.');
                            } catch (error: any) {
                              showNotification(error.message, 'error');
                            }
                          }
                        }}
                        className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {combinedBarbers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                    Nenhum barbeiro cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Units Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#8162ff]" /> Unidades
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((unit) => (
            <div key={unit.id} className="bg-[#1a1a1a] rounded-2xl p-6 ring-1 ring-[#262626] hover:ring-[#333] transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
                  <MapPin className="h-6 w-6" />
                </div>
                <button 
                  onClick={() => handleDeleteUnit(unit.id)}
                  className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{unit.name}</h3>
              <p className="text-zinc-500 text-sm mb-4">{unit.address}</p>
              {unit.google_maps_link && (
                <a 
                  href={unit.google_maps_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-[#8162ff] hover:underline"
                >
                  Ver no Google Maps
                </a>
              )}
            </div>
          ))}
          {units.length === 0 && (
            <div className="col-span-full py-12 text-center bg-[#1a1a1a] rounded-2xl ring-1 ring-dashed ring-[#262626]">
              <MapPin className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500">Nenhuma unidade cadastrada.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Cadastrar Cliente */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300 ring-1 ring-[#262626]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#8162ff] text-white rounded-xl">
                  <UserPlus className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tighter">Novo Cliente</h3>
              </div>
              <button onClick={() => setIsUserModalOpen(false)} className="p-2 text-zinc-500 hover:text-white hover:bg-[#262626] rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Nome Completo</label>
                <input 
                  required
                  type="text"
                  placeholder="Ex: João Silva"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Email</label>
                <input 
                  required
                  type="email"
                  placeholder="joao@email.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Telefone</label>
                <input 
                  required
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={newPhone}
                  onChange={(e) => setNewPhone(maskPhone(e.target.value))}
                  className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Senha Temporária</label>
                <input 
                  required
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff]"
                />
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-[#8162ff] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#6e4ff0] disabled:opacity-50 shadow-lg shadow-[#8162ff]/20 transition-all active:scale-[0.98]"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                Cadastrar Cliente
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cadastrar Profissional */}
      {isBarberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300 ring-1 ring-[#262626]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#8162ff] text-white rounded-xl">
                    {editingBarberId ? <Edit3 className="h-6 w-6" /> : <UserCheck className="h-6 w-6" />}
                  </div>
                  <h3 className="text-2xl font-bold text-white tracking-tighter">
                    {editingBarberId ? 'Editar Barbeiro' : 'Novo Barbeiro'}
                  </h3>
                </div>
                <button onClick={() => {
                  setIsBarberModalOpen(false);
                  setEditingBarberId(null);
                  setSelectedUserId('');
                  setSelectedUnitId('');
                  setSpecialties('');
                }} className="p-2 text-zinc-500 hover:text-white hover:bg-[#262626] rounded-full transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleCreateBarber} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <Users className="h-4 w-4" /> Selecionar Usuário
                  </label>
                  <div className="relative">
                    <select 
                      required
                      disabled={!!editingBarberId}
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full rounded-xl border-none bg-[#262626] py-3 pl-4 pr-10 text-white focus:ring-2 focus:ring-[#8162ff] appearance-none disabled:opacity-50"
                    >
                      <option value="">Escolha um cliente...</option>
                      {editingBarberId ? (
                        <option value={selectedUserId}>{allUsers.find(u => u.id === selectedUserId)?.name}</option>
                      ) : (
                        allUsers.filter(u => (u.role === 'client' || u.role === 'barber') && !barbersList.some(b => b.user_id === u.id)).map(u => (
                          <option key={u.id} value={u.id}>{u.name || 'Sem Nome'} ({u.email})</option>
                        ))
                      )}
                    </select>
                    {!editingBarberId && <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />}
                  </div>
                </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Unidade
                </label>
                <div className="relative">
                  <select 
                    required
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    className="w-full rounded-xl border-none bg-[#262626] py-3 pl-4 pr-10 text-white focus:ring-2 focus:ring-[#8162ff] appearance-none"
                  >
                    <option value="">Selecione uma unidade...</option>
                    {units.map(unit => (
                      <option key={unit.id} value={unit.id}>{unit.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <Scissors className="h-4 w-4" /> Especialidades
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input 
                    type="text"
                    placeholder="Ex: Degradê, Barba, Pigmentação"
                    value={specialties}
                    onChange={(e) => setSpecialties(e.target.value)}
                    className="w-full rounded-xl border-none bg-[#262626] py-3 pl-10 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Foto de Perfil
                </label>
                <input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'barber')}
                  className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#8162ff] file:text-white hover:file:bg-[#6e4ff0]"
                />
              </div>

              <button 
                type="submit"
                disabled={submitting || !selectedUserId || uploading}
                className="w-full py-4 bg-[#8162ff] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#6e4ff0] disabled:opacity-50 shadow-lg shadow-[#8162ff]/20 transition-all active:scale-[0.98]"
              >
                {submitting || uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingBarberId ? <Edit3 className="h-5 w-5" /> : <Plus className="h-5 w-5" />)}
                {uploading ? 'Enviando Foto...' : (editingBarberId ? 'Salvar Alterações' : 'Promover a Profissional')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Usuário */}
      {isUserEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300 ring-1 ring-[#262626]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#8162ff] text-white rounded-xl">
                  <Edit3 className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tighter">Editar Usuário</h3>
              </div>
              <button onClick={() => setIsUserEditModalOpen(false)} className="p-2 text-zinc-500 hover:text-white hover:bg-[#262626] rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Nome</label>
                <input 
                  required
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white focus:ring-2 focus:ring-[#8162ff]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Email</label>
                <input 
                  required
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white focus:ring-2 focus:ring-[#8162ff]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Telefone</label>
                <input 
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(maskPhone(e.target.value))}
                  className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white focus:ring-2 focus:ring-[#8162ff]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Cargo</label>
                  <select 
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white focus:ring-2 focus:ring-[#8162ff]"
                  >
                    <option value="client">Cliente</option>
                    <option value="barber">Barbeiro</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {editRole !== 'barber' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Assinatura</label>
                    <select 
                      value={editSubscription}
                      onChange={(e) => setEditSubscription(e.target.value)}
                      className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white focus:ring-2 focus:ring-[#8162ff]"
                    >
                      <option value="comum">Comum</option>
                      <option value="clube">Clube</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Foto de Perfil
                </label>
                <input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'user')}
                  className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#8162ff] file:text-white hover:file:bg-[#6e4ff0]"
                />
              </div>

              <button 
                type="submit"
                disabled={submitting || uploading}
                className="w-full py-4 bg-[#8162ff] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#6e4ff0] disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {submitting || uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Settings className="h-5 w-5" />}
                {uploading ? 'Enviando Foto...' : 'Salvar Alterações'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-sm p-8 shadow-2xl ring-1 ring-[#262626]">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                <Trash2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-white">Confirmar Exclusão</h3>
              <p className="text-zinc-500 text-sm">
                Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-[#262626] text-white font-bold hover:bg-[#333] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDeleteUser}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      {imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setImageToCrop(null);
            setCropType(null);
          }}
        />
      )}

      {/* Modal Cadastrar Serviço */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300 ring-1 ring-[#262626]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#8162ff] text-white rounded-xl">
                  <Scissors className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tighter">Novo Serviço</h3>
              </div>
              <button onClick={() => setIsServiceModalOpen(false)} className="p-2 text-zinc-500 hover:text-white hover:bg-[#262626] rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateService} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <Edit3 className="h-4 w-4" /> Nome do Serviço
                </label>
                <input 
                  required
                  type="text"
                  placeholder="Ex: Corte Social"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <Package className="h-4 w-4" /> Descrição
                </label>
                <textarea 
                  placeholder="Descreva o que está incluso no serviço..."
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff] min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Preço (R$)
                  </label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                    className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Duração (min)
                  </label>
                  <input 
                    required
                    type="number"
                    value={serviceDuration}
                    onChange={(e) => setServiceDuration(e.target.value)}
                    className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff]"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-[#8162ff] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#6e4ff0] disabled:opacity-50 shadow-lg shadow-[#8162ff]/20 transition-all active:scale-[0.98]"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                Salvar Serviço
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Modal Cadastrar Unidade */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 ring-1 ring-[#262626]">
            <div className="p-8 border-b border-[#262626] flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Nova Unidade</h3>
              <button onClick={() => setIsUnitModalOpen(false)} className="p-2 text-zinc-500 hover:text-white hover:bg-[#262626] rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateUnit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <Edit3 className="h-4 w-4" /> Nome da Unidade
                </label>
                <input 
                  required
                  type="text"
                  placeholder="Ex: Unidade Centro"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Endereço Completo
                </label>
                <input 
                  required
                  type="text"
                  placeholder="Rua Exemplo, 123 - Centro"
                  value={unitAddress}
                  onChange={(e) => setUnitAddress(e.target.value)}
                  className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Link Google Maps (Opcional)
                </label>
                <input 
                  type="url"
                  placeholder="https://goo.gl/maps/..."
                  value={unitMapsLink}
                  onChange={(e) => setUnitMapsLink(e.target.value)}
                  className="w-full rounded-xl border-none bg-[#262626] py-3 px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff]"
                />
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-[#8162ff] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#6e4ff0] disabled:opacity-50 shadow-lg shadow-[#8162ff]/20 transition-all active:scale-[0.98]"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                Cadastrar Unidade
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


