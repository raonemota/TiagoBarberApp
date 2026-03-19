import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNotification } from '../contexts/NotificationContext';
import { 
  Package, ArrowLeft, Search, Plus, Trash2, Edit3, Loader2, X, DollarSign, Image as ImageIcon
} from 'lucide-react';
import { Link } from 'react-router';
import ImageCropper from '../components/ImageCropper';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
}

export default function AdminProducts() {
  const { showNotification } = useNotification();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Product form states
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productAvatar, setProductAvatar] = useState<File | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  
  // Image crop states
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      if (data) setProducts(data);
    } catch (error: any) {
      showNotification(error.message || 'Erro ao buscar produtos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], 'product.jpg', { type: 'image/jpeg' });
    setProductAvatar(file);
    setImageToCrop(null);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let imageUrl = '';
      
      if (productAvatar) {
        setUploading(true);
        const fileExt = productAvatar.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, productAvatar);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        
        imageUrl = publicUrl;
      }

      const productData: any = {
        name: productName,
        description: productDescription,
        price: parseFloat(productPrice),
      };

      if (imageUrl) productData.image_url = imageUrl;

      if (editingProductId) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProductId);
        if (error) throw error;
        showNotification('Produto atualizado com sucesso!', 'success');
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);
        if (error) throw error;
        showNotification('Produto criado com sucesso!', 'success');
      }

      setIsProductModalOpen(false);
      setEditingProductId(null);
      setProductName('');
      setProductDescription('');
      setProductPrice('');
      setProductAvatar(null);
      fetchProducts();
    } catch (error: any) {
      showNotification(error.message || 'Erro ao salvar produto', 'error');
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
      showNotification('Produto excluído com sucesso!', 'success');
      fetchProducts();
    } catch (error: any) {
      showNotification(error.message || 'Erro ao excluir produto', 'error');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white dark:bg-black p-4 md:p-8 space-y-8 pb-24 transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link to="/admin" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors text-sm mb-2">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
          </Link>
          <h1 className="text-3xl font-bold tracking-tighter text-zinc-900 dark:text-white">Todos os Produtos</h1>
          <p className="text-zinc-500">Lista completa e compacta de produtos da barbearia.</p>
        </div>
        <button 
          onClick={() => {
            setEditingProductId(null);
            setProductName('');
            setProductDescription('');
            setProductPrice('');
            setProductAvatar(null);
            setIsProductModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#8162ff] px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-[#6e4ff0] transition-all active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Novo Produto
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
        <input 
          type="text"
          placeholder="Buscar produtos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-100 dark:bg-[#1a1a1a] border-none rounded-2xl py-3 pl-12 pr-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff] transition-all"
        />
      </div>

      {/* Compact List */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl ring-1 ring-zinc-200 dark:ring-[#262626] overflow-hidden shadow-sm dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-[#262626] bg-zinc-50/50 dark:bg-black/20">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Produto</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Descrição</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Preço</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-[#262626]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="h-8 w-8 text-[#8162ff] animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-[#262626] overflow-hidden flex-shrink-0">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-zinc-400 dark:text-zinc-700">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-zinc-900 dark:text-white text-sm">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-xs text-zinc-500 line-clamp-1 max-w-xs">{product.description}</p>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="text-sm font-black text-[#8162ff]">
                        R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingProductId(product.id);
                            setProductName(product.name);
                            setProductDescription(product.description || '');
                            setProductPrice(product.price.toString());
                            setIsProductModalOpen(true);
                          }}
                          className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Cadastrar Produto */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl ring-1 ring-zinc-200 dark:ring-[#262626] my-auto relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#8162ff]/10 text-[#8162ff] rounded-xl">
                  <Package className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tighter">
                  {editingProductId ? 'Editar Produto' : 'Novo Produto'}
                </h3>
              </div>
              <button onClick={() => setIsProductModalOpen(false)} className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-center mb-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-2xl bg-zinc-100 dark:bg-[#262626] flex items-center justify-center overflow-hidden ring-2 ring-[#8162ff]/20">
                      {productAvatar ? (
                        <img src={URL.createObjectURL(productAvatar)} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-zinc-400 dark:text-zinc-700" />
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                      <Plus className="h-6 w-6 text-white" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Nome do Produto</label>
                  <input 
                    type="text"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-[#262626] border-none rounded-xl py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff] transition-all"
                    placeholder="Ex: Pomada Modeladora"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Descrição</label>
                  <textarea 
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-[#262626] border-none rounded-xl py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff] transition-all h-24 resize-none"
                    placeholder="Breve descrição do produto..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Preço (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input 
                      type="number"
                      step="0.01"
                      required
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      className="w-full bg-zinc-100 dark:bg-[#262626] border-none rounded-xl py-3 pl-10 pr-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-[#8162ff] transition-all"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={submitting || uploading}
                className="w-full bg-[#8162ff] text-white font-bold py-4 rounded-xl hover:bg-[#6e4ff0] transition-all shadow-lg shadow-[#8162ff]/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingProductId ? 'Salvar Alterações' : 'Cadastrar Produto')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      {imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => setImageToCrop(null)}
          aspectRatio={4/3}
        />
      )}
    </div>
  );
}
