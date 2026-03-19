import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { supabase } from '../lib/supabase';
import ImageCropper from '../components/ImageCropper';
import { useNotification } from '../contexts/NotificationContext';
import { 
  Users, Scissors, Package, Settings, X, Plus, Loader2, 
  Mail, Phone, Shield, UserCheck, Search, ChevronDown,
  Trash2, Edit3, DollarSign, Clock, Briefcase, UserPlus,
  MapPin, ExternalLink, Trophy, CreditCard, TrendingUp,
  AlertCircle, CheckCircle2, Ban
} from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  description: string;
  is_featured: boolean;
  image_url: string;
  benefits?: PlanBenefit[];
}

interface PlanBenefit {
  id?: string;
  service_id: string;
  discount_percentage: number;
  service?: {
    name: string;
  };
}

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

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [barbersList, setBarbersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientSearch, setClientSearch] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [barberSearch, setBarberSearch] = useState('');
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
  const [isAdminSearchOpen, setIsAdminSearchOpen] = useState(false);
  const [isBarberSearchOpen, setIsBarberSearchOpen] = useState(false);
  
  // Modal states
  const [isBarberModalOpen, setIsBarberModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Cropper states
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropType, setCropType] = useState<'barber' | 'user' | 'product' | null>(null);

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

  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productAvatar, setProductAvatar] = useState<File | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // Subscription Club states
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptionStats, setSubscriptionStats] = useState({
    total: 0,
    active: 0,
    delayed: 0,
    canceled: 0,
    newThisMonth: 0
  });
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  
  // Plan form states
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planIsFeatured, setPlanIsFeatured] = useState(false);
  const [planImage, setPlanImage] = useState<File | null>(null);
  const [selectedBenefits, setSelectedBenefits] = useState<{ serviceId: string, discount: number }[]>([]);

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

      // Fetch products
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });
      
      if (productsData) setProducts(productsData);

      // Fetch services
      const { data: servicesData } = await supabase
        .from('services')
        .select('*')
        .order('name', { ascending: true });
      
      if (servicesData) setServices(servicesData);

      // Fetch barbers with unit info
      const { data: barbersListData } = await supabase
        .from('barbers')
        .select('*, users:user_id(*), units:unit_id(*)')
        .order('id', { ascending: true });
        
      if (barbersListData) setBarbersList(barbersListData);

      // Fetch subscription plans with benefits
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('*, benefits:plan_benefits(service_id, discount_percentage, service:services(name))')
        .order('price', { ascending: true });
      
      if (plansData) setSubscriptionPlans(plansData);

      // Fetch subscription stats
      const { data: subsData } = await supabase
        .from('user_subscriptions')
        .select('status, created_at');

      if (subsData) {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const subStats = subsData.reduce((acc, sub) => {
          acc.total++;
          if (sub.status === 'active') acc.active++;
          else if (sub.status === 'delayed') acc.delayed++;
          else if (sub.status === 'canceled') acc.canceled++;
          
          if (new Date(sub.created_at) >= firstDayOfMonth) {
            acc.newThisMonth++;
          }
          return acc;
        }, { total: 0, active: 0, delayed: 0, canceled: 0, newThisMonth: 0 });
        
        setSubscriptionStats(subStats);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'barber' | 'user' | 'product') => {
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
    } else if (cropType === 'product') {
      setProductAvatar(file);
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

      const url = editingServiceId ? `/api/services/${editingServiceId}` : '/api/services';
      const method = editingServiceId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
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
        throw new Error(errorData.message || errorData.details || 'Erro ao salvar serviço via servidor.');
      }

      const data = await response.json();
      console.log('Service saved successfully via proxy:', data);
      
      setIsServiceModalOpen(false);
      setServiceName('');
      setServiceDescription('');
      setServicePrice('');
      setEditingServiceId(null);
      fetchAdminData();
      showNotification(editingServiceId ? 'Serviço atualizado com sucesso!' : 'Serviço cadastrado com sucesso!');
    } catch (error: any) {
      console.error('Detailed error saving service:', error);
      showNotification(error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let imageUrl = '';

      if (productAvatar) {
        setUploading(true);
        const fileExt = productAvatar.name.split('.').pop();
        const fileName = `product-${Math.random()}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError } = await supabase.storage
          .from('avatars') // Using avatars bucket for simplicity, or create 'products' if needed
          .upload(filePath, productAvatar);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
          
        imageUrl = publicUrl;
      }

      const price = parseFloat(productPrice);
      if (isNaN(price)) throw new Error('Preço inválido.');

      if (editingProductId) {
        const { error } = await supabase
          .from('products')
          .update({
            name: productName,
            description: productDescription,
            price: price,
            image_url: imageUrl || undefined
          })
          .eq('id', editingProductId);

        if (error) throw error;
        showNotification('Produto atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('products')
          .insert({
            name: productName,
            description: productDescription,
            price: price,
            image_url: imageUrl
          });

        if (error) throw error;
        showNotification('Produto cadastrado com sucesso!');
      }

      setIsProductModalOpen(false);
      setProductName('');
      setProductDescription('');
      setProductPrice('');
      setProductAvatar(null);
      setEditingProductId(null);
      fetchAdminData();
    } catch (error: any) {
      console.error('Error creating/updating product:', error);
      showNotification(error.message, 'error');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      fetchAdminData();
      showNotification('Produto excluído com sucesso!');
    } catch (error: any) {
      console.error('Error deleting product:', error);
      showNotification(error.message, 'error');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
    
    try {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      fetchAdminData();
      showNotification('Serviço excluído com sucesso!');
    } catch (error: any) {
      console.error('Error deleting service:', error);
      showNotification(error.message, 'error');
    }
  };

  const handleEditService = (service: any) => {
    setServiceName(service.name);
    setServiceDescription(service.description || '');
    setServicePrice(service.price.toString());
    setServiceDuration(service.duration_minutes.toString());
    setEditingServiceId(service.id);
    setIsServiceModalOpen(true);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      
      let imageUrl = '';
      if (planImage) {
        const fileExt = planImage.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `plans/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('config')
          .upload(filePath, planImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('config')
          .getPublicUrl(filePath);
          
        imageUrl = publicUrl;
      }

      const planData = {
        name: planName,
        price: parseFloat(planPrice),
        description: planDescription,
        is_featured: planIsFeatured,
        ...(imageUrl && { image_url: imageUrl })
      };

      let planId = editingPlanId;

      if (editingPlanId) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(planData)
          .eq('id', editingPlanId);
        if (error) throw error;
        
        // Clear existing benefits to re-insert
        await supabase.from('plan_benefits').delete().eq('plan_id', editingPlanId);
      } else {
        const { data, error } = await supabase
          .from('subscription_plans')
          .insert([planData])
          .select()
          .single();
        if (error) throw error;
        planId = data.id;
      }

      // Insert benefits
      if (selectedBenefits.length > 0 && planId) {
        const benefitsToInsert = selectedBenefits.map(b => ({
          plan_id: planId,
          service_id: b.serviceId,
          discount_percentage: b.discount
        }));
        
        const { error: benefitsError } = await supabase
          .from('plan_benefits')
          .insert(benefitsToInsert);
        if (benefitsError) throw benefitsError;
      }

      showNotification(editingPlanId ? 'Plano atualizado!' : 'Plano criado!', 'success');
      setIsPlanModalOpen(false);
      fetchAdminData();
      resetPlanForm();
    } catch (error: any) {
      console.error('Error saving plan:', error);
      showNotification(error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este plano?')) return;
    
    try {
      const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
      if (error) throw error;
      fetchAdminData();
      showNotification('Plano excluído com sucesso!');
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      showNotification(error.message, 'error');
    }
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setPlanName(plan.name);
    setPlanDescription(plan.description || '');
    setPlanPrice(plan.price.toString());
    setPlanIsFeatured(plan.is_featured);
    setEditingPlanId(plan.id);
    
    // Set benefits
    if (plan.benefits) {
      setSelectedBenefits(plan.benefits.map(b => ({
        serviceId: b.service_id,
        discount: b.discount_percentage
      })));
    } else {
      setSelectedBenefits([]);
    }
    
    setIsPlanModalOpen(true);
  };

  const resetPlanForm = () => {
    setPlanName('');
    setPlanPrice('');
    setPlanDescription('');
    setPlanIsFeatured(false);
    setPlanImage(null);
    setEditingPlanId(null);
    setSelectedBenefits([]);
  };

  const toggleBenefit = (serviceId: string) => {
    setSelectedBenefits(prev => {
      const exists = prev.find(b => b.serviceId === serviceId);
      if (exists) {
        return prev.filter(b => b.serviceId !== serviceId);
      }
      return [...prev, { serviceId, discount: 100 }];
    });
  };

  const updateBenefitDiscount = (serviceId: string, discount: number) => {
    setSelectedBenefits(prev => prev.map(b => 
      b.serviceId === serviceId ? { ...b, discount } : b
    ));
  };

  const filteredClients = allUsers.filter(u => 
    u.role === 'client' && (
      (u.name?.toLowerCase() || '').includes(clientSearch.toLowerCase()) || 
      (u.email?.toLowerCase() || '').includes(clientSearch.toLowerCase())
    )
  );

  const filteredAdmins = allUsers.filter(u => 
    u.role === 'admin' && (
      (u.name?.toLowerCase() || '').includes(adminSearch.toLowerCase()) || 
      (u.email?.toLowerCase() || '').includes(adminSearch.toLowerCase())
    )
  );

  const combinedBarbers = allUsers
    .filter(u => u.role === 'barber' && (
      (u.name?.toLowerCase() || '').includes(barberSearch.toLowerCase()) || 
      (u.email?.toLowerCase() || '').includes(barberSearch.toLowerCase())
    ))
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
          <h1 className="text-3xl font-bold tracking-tighter text-zinc-900 dark:text-white">Administração</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Gerencie clientes, profissionais e serviços da sua barbearia.</p>
        </div>
        <div className="relative">
          <button 
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
            className="flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-bold text-black shadow-lg hover:bg-gold-light transition-all active:scale-95"
          >
            <Plus className={`h-5 w-5 transition-transform duration-300 ${isAddMenuOpen ? 'rotate-45' : ''}`} />
            Novo Cadastro
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isAddMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isAddMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsAddMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#1a1a1a] p-2 shadow-2xl ring-1 ring-zinc-200 dark:ring-[#262626] z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
                <button 
                  onClick={() => { setIsUnitModalOpen(true); setIsAddMenuOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#262626] hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <MapPin className="h-4 w-4 text-gold" /> Nova Unidade
                </button>
                <button 
                  onClick={() => { setIsUserModalOpen(true); setIsAddMenuOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#262626] hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <UserPlus className="h-4 w-4 text-gold" /> Novo Cliente
                </button>
                <button 
                  onClick={() => { 
                    setEditingServiceId(null);
                    setServiceName('');
                    setServiceDescription('');
                    setServicePrice('');
                    setServiceDuration('30');
                    setIsServiceModalOpen(true); 
                    setIsAddMenuOpen(false); 
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#262626] hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <Scissors className="h-4 w-4 text-gold" /> Novo Serviço
                </button>
                <button 
                  onClick={() => { 
                    setEditingProductId(null);
                    setProductName('');
                    setProductDescription('');
                    setProductPrice('');
                    setProductAvatar(null);
                    setIsProductModalOpen(true); 
                    setIsAddMenuOpen(false); 
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#262626] hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <Package className="h-4 w-4 text-gold" /> Novo Produto
                </button>
                <button 
                  onClick={() => { 
                    resetPlanForm();
                    setIsPlanModalOpen(true); 
                    setIsAddMenuOpen(false); 
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#262626] hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <Trophy className="h-4 w-4 text-gold" /> Novo Plano
                </button>
                <div className="my-1 h-px bg-zinc-100 dark:bg-[#262626]" />
                <button 
                  onClick={() => { setIsBarberModalOpen(true); setIsAddMenuOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-bold text-zinc-900 dark:text-white bg-gold/10 hover:bg-gold/20 transition-colors"
                >
                  <UserCheck className="h-4 w-4 text-gold" /> Novo Barbeiro
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
        {[
          { name: 'Clientes', value: stats.users, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10', targetId: 'clientes-section' },
          { name: 'Barbeiros', value: stats.barbers, icon: Briefcase, color: 'text-indigo-400', bg: 'bg-indigo-500/10', targetId: 'barbeiros-section' },
          { name: 'Serviços', value: stats.services, icon: Scissors, color: 'text-emerald-400', bg: 'bg-emerald-500/10', targetId: 'servicos-section' },
          { name: 'Produtos', value: stats.products, icon: Package, color: 'text-amber-400', bg: 'bg-amber-500/10', targetId: 'produtos-section' },
          { name: 'Unidades', value: stats.units, icon: MapPin, color: 'text-purple-400', bg: 'bg-purple-500/10', targetId: 'unidades-section' },
          { name: 'Clube', value: subscriptionStats.total, icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/10', targetId: 'clube-section' },
        ].map((card) => (
          <button 
            key={card.name} 
            onClick={() => {
              const element = document.getElementById(card.targetId);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            className="relative overflow-hidden rounded-lg bg-white dark:bg-[#1a1a1a] p-3 shadow-sm ring-1 ring-zinc-200 dark:ring-[#262626] hover:ring-zinc-300 dark:hover:ring-[#333] transition-all text-left"
          >
            <div className="flex items-center gap-2">
              <div className={`inline-flex rounded-md p-1.5 ${card.bg} ${card.color}`}>
                <card.icon className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 leading-none">{card.name}</p>
                <p className="mt-0.5 text-lg font-bold text-zinc-900 dark:text-white leading-none">{card.value}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Users Management Section */}
      <div id="clientes-section" className="rounded-3xl bg-white dark:bg-[#1a1a1a] shadow-sm ring-1 ring-zinc-200 dark:ring-[#262626] overflow-hidden">
        <div className="border-b border-zinc-100 dark:border-[#262626] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-gold" />
                Gestão de Clientes
              </h2>
              <div className="flex items-center gap-2">
                {isClientSearchOpen ? (
                  <div className="relative flex items-center animate-in slide-in-from-right-4 duration-300">
                    <Search className="absolute left-3 h-4 w-4 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Buscar cliente..." 
                      value={clientSearch}
                      autoFocus
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="w-48 sm:w-64 rounded-xl border-none bg-zinc-100 dark:bg-[#262626] py-1.5 pl-9 pr-8 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 focus:ring-2 focus:ring-gold"
                    />
                    <button 
                      onClick={() => {
                        setIsClientSearchOpen(false);
                        setClientSearch('');
                      }}
                      className="absolute right-2 p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsClientSearchOpen(true)}
                    className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#262626] rounded-lg transition-colors"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-[#262626]/50 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Assinatura</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-[#262626]">
              {filteredClients.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-[#262626]/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-[#262626] flex items-center justify-center text-zinc-900 dark:text-white font-bold ring-1 ring-zinc-200 dark:ring-[#333]">
                        {user.name?.charAt(0) || '?'}
                      </div>
                      <span className="font-bold text-zinc-900 dark:text-white">{user.name || 'Sem Nome'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <Mail className="h-3.5 w-3.5 text-gold" /> {user.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <Phone className="h-3.5 w-3.5 text-gold" /> {user.phone || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold uppercase ${user.subscription_type === 'clube' ? 'text-amber-500' : 'text-zinc-400 dark:text-zinc-600'}`}>
                      {user.subscription_type === 'clube' ? '★ Assinante Clube' : 'Comum'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditUser(user)}
                        className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#262626] rounded-lg transition-colors"
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
        <div id="admins-section" className="rounded-3xl bg-white dark:bg-[#1a1a1a] shadow-sm ring-1 ring-zinc-200 dark:ring-[#262626] overflow-hidden">
          <div className="border-b border-zinc-100 dark:border-[#262626] p-4">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-500" />
                Gestão de Administradores
              </h2>
              <div className="flex items-center gap-2">
                {isAdminSearchOpen ? (
                  <div className="relative flex items-center animate-in slide-in-from-right-4 duration-300">
                    <Search className="absolute left-3 h-4 w-4 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Buscar admin..." 
                      value={adminSearch}
                      autoFocus
                      onChange={(e) => setAdminSearch(e.target.value)}
                      className="w-48 sm:w-64 rounded-xl border-none bg-zinc-100 dark:bg-[#262626] py-1.5 pl-9 pr-8 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 focus:ring-2 focus:ring-gold"
                    />
                    <button 
                      onClick={() => {
                        setIsAdminSearchOpen(false);
                        setAdminSearch('');
                      }}
                      className="absolute right-2 p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsAdminSearchOpen(true)}
                    className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#262626] rounded-lg transition-colors"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-[#262626]/50 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <th className="px-6 py-4">Administrador</th>
                  <th className="px-6 py-4">Contato</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-[#262626]">
                {filteredAdmins.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-[#262626]/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold ring-1 ring-purple-500/20">
                          {user.name?.charAt(0) || '?'}
                        </div>
                        <span className="font-bold text-zinc-900 dark:text-white">{user.name || 'Sem Nome'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <Mail className="h-3.5 w-3.5 text-purple-500" /> {user.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEditUser(user)}
                          className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#262626] rounded-lg transition-colors"
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
      <div id="barbeiros-section" className="rounded-3xl bg-white dark:bg-[#1a1a1a] shadow-sm ring-1 ring-zinc-200 dark:ring-[#262626] overflow-hidden">
        <div className="border-b border-zinc-100 dark:border-[#262626] p-4">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-gold" />
                Gestão de Barbeiros
              </h2>
              <div className="flex items-center gap-2">
                {isBarberSearchOpen ? (
                  <div className="relative flex items-center animate-in slide-in-from-right-4 duration-300">
                    <Search className="absolute left-3 h-4 w-4 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Buscar barbeiro..." 
                      value={barberSearch}
                      autoFocus
                      onChange={(e) => setBarberSearch(e.target.value)}
                      className="w-48 sm:w-64 rounded-xl border-none bg-zinc-100 dark:bg-[#262626] py-1.5 pl-9 pr-8 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 focus:ring-2 focus:ring-gold"
                    />
                    <button 
                      onClick={() => {
                        setIsBarberSearchOpen(false);
                        setBarberSearch('');
                      }}
                      className="absolute right-2 p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsBarberSearchOpen(true)}
                    className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#262626] rounded-lg transition-colors"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-[#262626]/50 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <th className="px-6 py-4">Barbeiro</th>
                <th className="px-6 py-4">Unidade</th>
                <th className="px-6 py-4">Especialidades</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-[#262626]">
              {combinedBarbers.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-[#262626]/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-[#262626] overflow-hidden ring-1 ring-zinc-200 dark:ring-[#333]">
                        <img 
                          src={item.user.avatar_url || BARBER_ILLUSTRATION} 
                          alt={item.user.name}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="font-bold text-zinc-900 dark:text-white">{item.user.name || 'Sem Nome'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                      <MapPin className="h-4 w-4 text-gold" />
                      <span className="text-sm">{item.barber?.units?.name || 'Não atribuída'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">{item.barber?.specialties || 'Nenhuma'}</span>
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

      {/* Services Management Section */}
      <div id="servicos-section" className="rounded-3xl bg-white dark:bg-[#1a1a1a] shadow-sm ring-1 ring-zinc-200 dark:ring-[#262626] overflow-hidden">
        <div className="border-b border-zinc-100 dark:border-[#262626] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Scissors className="h-5 w-5 text-gold" />
              Gestão de Serviços
            </h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-[#262626]/50 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <th className="px-6 py-4">Serviço</th>
                <th className="px-6 py-4">Duração</th>
                <th className="px-6 py-4">Preço</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-[#262626]">
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-zinc-50 dark:hover:bg-[#262626]/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-900 dark:text-white text-sm">{service.name}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">{service.description}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <Clock className="h-3.5 w-3.5 text-gold" /> {service.duration_minutes} min
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">
                      R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditService(service)}
                        className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#262626] rounded-lg transition-colors"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteService(service.id)}
                        className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                    Nenhum serviço cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Products Section */}
      <div id="produtos-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-gold" /> Produtos Principais
          </h2>
          <Link 
            to="/admin/products"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#262626] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-[#333] transition-all text-[10px] font-bold uppercase tracking-wider"
          >
            Ver todos os produtos
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {products.slice(0, 5).map((product) => (
            <div key={product.id} className="bg-white dark:bg-[#1a1a1a] rounded-xl overflow-hidden ring-1 ring-zinc-200 dark:ring-[#262626] hover:ring-zinc-300 dark:hover:ring-[#333] transition-all group">
              <div className="aspect-[4/3] relative overflow-hidden bg-zinc-100 dark:bg-[#262626]">
                {product.image_url ? (
                  <img 
                    src={product.image_url} 
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-700">
                    <Package className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 gap-1.5">
                  <button 
                    onClick={() => {
                      setEditingProductId(product.id);
                      setProductName(product.name);
                      setProductDescription(product.description || '');
                      setProductPrice(product.price.toString());
                      setIsProductModalOpen(true);
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-white/10 backdrop-blur-md text-white text-[10px] font-bold hover:bg-white/20 transition-colors"
                  >
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDeleteProduct(product.id)}
                    className="p-1.5 rounded-lg bg-red-500/20 backdrop-blur-md text-red-500 hover:bg-red-500/30 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <div className="flex flex-col mb-1">
                  <h3 className="font-bold text-zinc-900 dark:text-white text-xs truncate">{product.name}</h3>
                  <span className="text-gold font-black text-xs">
                    R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-[9px] line-clamp-1 leading-tight">{product.description}</p>
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white dark:bg-[#1a1a1a] rounded-2xl ring-1 ring-dashed ring-zinc-200 dark:ring-[#262626]">
              <Package className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500 dark:text-zinc-400">Nenhum produto cadastrado.</p>
            </div>
          )}
        </div>
      </div>

      {/* Units Section */}
      <div id="unidades-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <MapPin className="h-5 w-5 text-gold" /> Unidades
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((unit) => (
            <div key={unit.id} className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 ring-1 ring-zinc-200 dark:ring-[#262626] hover:ring-zinc-300 dark:hover:ring-[#333] transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-gold/10 text-gold">
                  <MapPin className="h-6 w-6" />
                </div>
                <button 
                  onClick={() => handleDeleteUnit(unit.id)}
                  className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">{unit.name}</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">{unit.address}</p>
              {unit.google_maps_link && (
                <a 
                  href={unit.google_maps_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-gold hover:underline"
                >
                  Ver no Google Maps
                </a>
              )}
            </div>
          ))}
          {units.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white dark:bg-[#1a1a1a] rounded-2xl ring-1 ring-dashed ring-zinc-200 dark:ring-[#262626]">
              <MapPin className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500 dark:text-zinc-400">Nenhuma unidade cadastrada.</p>
            </div>
          )}
        </div>
      </div>

      {/* Subscription Club Section */}
      <div id="clube-section" className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Trophy className="h-5 w-5 text-gold" /> Clube de Assinatura
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-900 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800">
              {subscriptionStats.total} Assinantes
            </span>
          </div>
        </div>

        {/* Subscription Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl ring-1 ring-zinc-200 dark:ring-[#262626] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Ativos</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">{subscriptionStats.active}</span>
            <div className="flex items-center gap-1 text-[10px] text-emerald-500">
              <TrendingUp className="h-3 w-3" />
              <span>+{subscriptionStats.newThisMonth} este mês</span>
            </div>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl ring-1 ring-zinc-200 dark:ring-[#262626] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Atrasados</span>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </div>
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">{subscriptionStats.delayed}</span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Requer atenção</span>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl ring-1 ring-zinc-200 dark:ring-[#262626] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Cancelados</span>
              <Ban className="h-4 w-4 text-red-500" />
            </div>
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">{subscriptionStats.canceled}</span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Total histórico</span>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl ring-1 ring-zinc-200 dark:ring-[#262626] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Faturamento</span>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">
              R$ {(subscriptionPlans.reduce((acc, p) => acc + (p.price * subscriptionStats.active), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Estimativa mensal</span>
          </div>
        </div>

        {/* Plans Management */}
        <div className="rounded-3xl bg-white dark:bg-[#1a1a1a] shadow-sm ring-1 ring-zinc-200 dark:ring-[#262626] overflow-hidden">
          <div className="border-b border-zinc-100 dark:border-[#262626] p-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-widest">Planos Disponíveis</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-[#262626]/50 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <th className="px-6 py-4">Plano</th>
                  <th className="px-6 py-4">Preço</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-[#262626]">
                {subscriptionPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-zinc-50 dark:hover:bg-[#262626]/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-[#262626] overflow-hidden flex items-center justify-center">
                          {plan.image_url ? (
                            <img src={plan.image_url} alt={plan.name} className="h-full w-full object-cover" />
                          ) : (
                            <Trophy className="h-5 w-5 text-zinc-400 dark:text-zinc-700" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-2">
                            {plan.name}
                            {plan.is_featured && <span className="text-[8px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 px-1.5 py-0.5 rounded-full border border-yellow-500/20">EM ALTA</span>}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">{plan.description}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-zinc-900 dark:text-white">R$ {plan.price.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-500 ring-1 ring-inset ring-emerald-500/20">
                        Ativo
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEditPlan(plan)}
                          className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#262626] rounded-lg transition-colors"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeletePlan(plan.id)}
                          className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Cadastrar Cliente */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in duration-300 ring-1 ring-zinc-200 dark:ring-[#262626] my-auto relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gold text-black rounded-xl">
                  <UserPlus className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tighter">Novo Cliente</h3>
              </div>
              <button onClick={() => setIsUserModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#262626] rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Nome Completo</label>
                <input 
                  required
                  type="text"
                  placeholder="Ex: João Silva"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Email</label>
                <input 
                  required
                  type="email"
                  placeholder="joao@email.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Telefone</label>
                <input 
                  required
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={newPhone}
                  onChange={(e) => setNewPhone(maskPhone(e.target.value))}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Senha Temporária</label>
                <input 
                  required
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-gold text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gold/90 disabled:opacity-50 shadow-lg shadow-gold/20 transition-all active:scale-[0.98]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in duration-300 ring-1 ring-zinc-200 dark:ring-[#262626] my-auto relative max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gold text-black rounded-xl">
                    {editingBarberId ? <Edit3 className="h-6 w-6" /> : <UserCheck className="h-6 w-6" />}
                  </div>
                  <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tighter">
                    {editingBarberId ? 'Editar Barbeiro' : 'Novo Barbeiro'}
                  </h3>
                </div>
                <button onClick={() => {
                  setIsBarberModalOpen(false);
                  setEditingBarberId(null);
                  setSelectedUserId('');
                  setSelectedUnitId('');
                  setSpecialties('');
                }} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#262626] rounded-full transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleCreateBarber} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                    <Users className="h-4 w-4" /> Selecionar Usuário
                  </label>
                  <div className="relative">
                    <select 
                      required
                      disabled={!!editingBarberId}
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 pl-4 pr-10 text-zinc-900 dark:text-white focus:ring-2 focus:ring-gold/20 appearance-none disabled:opacity-50"
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
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Unidade
                </label>
                <div className="relative">
                  <select 
                    required
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 pl-4 pr-10 text-zinc-900 dark:text-white focus:ring-2 focus:ring-gold/20 appearance-none"
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
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <Scissors className="h-4 w-4" /> Especialidades
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input 
                    type="text"
                    placeholder="Ex: Degradê, Barba, Pigmentação"
                    value={specialties}
                    onChange={(e) => setSpecialties(e.target.value)}
                    className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 pl-10 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Foto de Perfil
                </label>
                <input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'barber')}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gold file:text-black hover:file:bg-gold/90"
                />
              </div>

              <button 
                type="submit"
                disabled={submitting || !selectedUserId || uploading}
                className="w-full py-4 bg-gold text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gold/90 disabled:opacity-50 shadow-lg shadow-gold/20 transition-all active:scale-[0.98]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in duration-300 ring-1 ring-zinc-200 dark:ring-[#262626] my-auto relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gold text-black rounded-xl">
                  <Edit3 className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tighter">Editar Usuário</h3>
              </div>
              <button onClick={() => setIsUserEditModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#262626] rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Nome</label>
                <input 
                  required
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Email</label>
                <input 
                  required
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Telefone</label>
                <input 
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(maskPhone(e.target.value))}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Cargo</label>
                  <select 
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white focus:ring-2 focus:ring-gold/20"
                  >
                    <option value="client">Cliente</option>
                    <option value="barber">Barbeiro</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {editRole !== 'barber' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Assinatura</label>
                    <select 
                      value={editSubscription}
                      onChange={(e) => setEditSubscription(e.target.value)}
                      className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white focus:ring-2 focus:ring-gold/20"
                    >
                      <option value="comum">Comum</option>
                      <option value="clube">Clube</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Foto de Perfil
                </label>
                <input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'user')}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gold file:text-black hover:file:bg-gold/90"
                />
              </div>

              <button 
                type="submit"
                disabled={submitting || uploading}
                className="w-full py-4 bg-gold text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gold/90 disabled:opacity-50 transition-all active:scale-[0.98]"
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
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-sm p-8 shadow-2xl ring-1 ring-zinc-200 dark:ring-[#262626]">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                <Trash2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Confirmar Exclusão</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-zinc-100 dark:bg-[#262626] text-zinc-900 dark:text-white font-bold hover:bg-zinc-200 dark:hover:bg-[#333] transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in duration-300 ring-1 ring-zinc-200 dark:ring-[#262626] my-auto relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gold text-black rounded-xl">
                  {editingServiceId ? <Edit3 className="h-6 w-6" /> : <Scissors className="h-6 w-6" />}
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tighter">
                  {editingServiceId ? 'Editar Serviço' : 'Novo Serviço'}
                </h3>
              </div>
              <button onClick={() => {
                setIsServiceModalOpen(false);
                setEditingServiceId(null);
                setServiceName('');
                setServiceDescription('');
                setServicePrice('');
                setServiceDuration('30');
              }} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#262626] rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateService} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <Edit3 className="h-4 w-4" /> Nome do Serviço
                </label>
                <input 
                  required
                  type="text"
                  placeholder="Ex: Corte Social"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <Package className="h-4 w-4" /> Descrição
                </label>
                <textarea 
                  placeholder="Descreva o que está incluso no serviço..."
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20 min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Preço (R$)
                  </label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                    className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Duração (min)
                  </label>
                  <input 
                    required
                    type="number"
                    value={serviceDuration}
                    onChange={(e) => setServiceDuration(e.target.value)}
                    className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-gold text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gold/90 disabled:opacity-50 shadow-lg shadow-gold/20 transition-all active:scale-[0.98]"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingServiceId ? <Edit3 className="h-5 w-5" /> : <Plus className="h-5 w-5" />)}
                {editingServiceId ? 'Salvar Alterações' : 'Cadastrar Serviço'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Modal Plano de Assinatura */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in duration-300 ring-1 ring-zinc-200 dark:ring-[#262626] my-auto relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gold text-black rounded-xl">
                  <Trophy className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tighter">
                  {editingPlanId ? 'Editar Plano' : 'Novo Plano'}
                </h3>
              </div>
              <button onClick={() => setIsPlanModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#262626] rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Nome do Plano</label>
                <input 
                  type="text" 
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-[#262626] border-none rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20 transition-all"
                  placeholder="Ex: Plano Premium"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Valor Mensal (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={planPrice}
                  onChange={(e) => setPlanPrice(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-[#262626] border-none rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20 transition-all"
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Descrição</label>
                <textarea 
                  value={planDescription}
                  onChange={(e) => setPlanDescription(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-[#262626] border-none rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20 transition-all min-h-[100px]"
                  placeholder="Descreva os benefícios do plano..."
                  required
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-[#262626] rounded-xl">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-gold" />
                  <span className="text-sm font-bold text-zinc-900 dark:text-white">Plano em Alta</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPlanIsFeatured(!planIsFeatured)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${planIsFeatured ? 'bg-gold' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${planIsFeatured ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Imagem do Plano</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setPlanImage(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-gold/10 file:text-gold hover:file:bg-gold/20"
                />
              </div>

              <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-[#262626]">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 block">Serviços Inclusos / Descontos</label>
                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                  {services.map((service) => {
                    const benefit = selectedBenefits.find(b => b.serviceId === service.id);
                    return (
                      <div key={service.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-[#262626] rounded-xl group transition-all hover:bg-zinc-100 dark:hover:bg-[#323232]">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleBenefit(service.id)}
                            className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${benefit ? 'bg-gold border-gold' : 'border-zinc-300 dark:border-zinc-600'}`}
                          >
                            {benefit && <CheckCircle2 className="h-4 w-4 text-black" />}
                          </button>
                          <span className="text-sm text-zinc-600 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{service.name}</span>
                        </div>
                        
                        {benefit && (
                          <div className="flex items-center gap-2">
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={benefit.discount}
                              onChange={(e) => updateBenefitDiscount(service.id, parseInt(e.target.value) || 0)}
                              className="w-16 bg-white dark:bg-[#1a1a1a] border-zinc-200 dark:border-none rounded-lg px-2 py-1 text-xs text-zinc-900 dark:text-white text-center focus:ring-1 focus:ring-gold"
                            />
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">% OFF</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-zinc-500 italic">* 100% OFF significa que o serviço é gratuito/ilimitado para o assinante.</p>
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-gold text-black font-bold py-4 rounded-xl shadow-lg shadow-gold/20 hover:bg-gold/90 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trophy className="h-5 w-5" />}
                {editingPlanId ? 'Salvar Alterações' : 'Criar Plano'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cadastrar Unidade */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 ring-1 ring-zinc-200 dark:ring-[#262626] my-auto relative">
            <div className="p-6 md:p-8 border-b border-zinc-100 dark:border-[#262626] flex items-center justify-between">
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">Nova Unidade</h3>
              <button onClick={() => setIsUnitModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#262626] rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateUnit} className="p-6 md:p-8 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <Edit3 className="h-4 w-4" /> Nome da Unidade
                </label>
                <input 
                  required
                  type="text"
                  placeholder="Ex: Unidade Centro"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Endereço Completo
                </label>
                <input 
                  required
                  type="text"
                  placeholder="Rua Exemplo, 123 - Centro"
                  value={unitAddress}
                  onChange={(e) => setUnitAddress(e.target.value)}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Link Google Maps (Opcional)
                </label>
                <input 
                  type="url"
                  placeholder="https://goo.gl/maps/..."
                  value={unitMapsLink}
                  onChange={(e) => setUnitMapsLink(e.target.value)}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-gold text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gold/90 disabled:opacity-50 shadow-lg shadow-gold/20 transition-all active:scale-[0.98]"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                Cadastrar Unidade
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cadastrar Produto */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in duration-300 ring-1 ring-zinc-200 dark:ring-[#262626] my-auto relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gold text-black rounded-xl">
                  <Package className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tighter">
                  {editingProductId ? 'Editar Produto' : 'Novo Produto'}
                </h3>
              </div>
              <button onClick={() => setIsProductModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#262626] rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <Edit3 className="h-4 w-4" /> Nome do Produto
                </label>
                <input 
                  required
                  type="text"
                  placeholder="Ex: Pomada Modeladora"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <Package className="h-4 w-4" /> Descrição
                </label>
                <textarea 
                  placeholder="Descreva o produto..."
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20 min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Preço (R$)
                </label>
                <input 
                  required
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Imagem do Produto
                </label>
                <input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'product')}
                  className="w-full rounded-xl border-none bg-zinc-50 dark:bg-[#262626] py-3 px-4 text-zinc-900 dark:text-white file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gold file:text-black hover:file:bg-gold/90"
                />
              </div>

              <button 
                type="submit"
                disabled={submitting || uploading}
                className="w-full py-4 bg-gold text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gold/90 disabled:opacity-50 shadow-lg shadow-gold/20 transition-all active:scale-[0.98]"
              >
                {submitting || uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingProductId ? <Edit3 className="h-5 w-5" /> : <Plus className="h-5 w-5" />)}
                {uploading ? 'Enviando Imagem...' : (editingProductId ? 'Salvar Alterações' : 'Cadastrar Produto')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


