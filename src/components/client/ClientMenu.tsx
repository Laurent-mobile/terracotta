import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useClientCart } from '../../contexts/ClientCartContext';
import { Search, Plus, Minus, ShoppingBag, Heart, Star } from 'lucide-react';
import toast from 'react-hot-toast';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id: string;
  is_available: boolean;
  image_url?: string;
  category?: { name: string };
}

interface ClientMenuProps {
  onViewCart: () => void;
}

export default function ClientMenu({ onViewCart }: ClientMenuProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('terra_cotta_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  
  const { addItem, getItemCount, items, updateQuantity } = useClientCart();

  useEffect(() => {
    loadMenu();
  }, []);

  useEffect(() => {
    localStorage.setItem('terra_cotta_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const loadMenu = async () => {
    try {
      setLoading(true);
      const [menuRes, categoriesRes] = await Promise.all([
        supabase.from('pos_menus').select(`*, category:pos_categories(name)`).eq('is_available', true).eq('is_active', true).order('name'),
        supabase.from('pos_categories').select('*').eq('is_active', true).order('display_order'),
      ]);

      if (menuRes.error) throw menuRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setMenuItems(menuRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error('Erreur chargement menu:', error);
      toast.error('Impossible de charger le menu');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, searchTerm, selectedCategory]);

  const groupedItems = useMemo(() => {
    return categories
      .map((cat) => ({ ...cat, items: filteredItems.filter((item) => item.category_id === cat.id) }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, filteredItems]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const handleAddToCart = (item: MenuItem) => {
    addItem({ id: item.id, name: item.name, price: item.price, image: item.image_url, category: item.category?.name });
    toast.success(`${item.name} ajouté au panier`, { icon: '🛒' });
    if (navigator.vibrate) navigator.vibrate(10);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 p-4 pb-24 space-y-4">
        <div className="h-10 bg-gray-200 rounded-lg animate-shimmer w-1/3"></div>
        <div className="h-12 bg-gray-200 rounded-xl animate-shimmer"></div>
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 w-24 bg-gray-200 rounded-full animate-shimmer"></div>)}
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-soft border border-gray-100 flex gap-4 animate-shimmer">
            <div className="w-24 h-24 bg-gray-200 rounded-xl"></div>
            <div className="flex-1 space-y-2 py-1">
              <div className="h-5 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50 pb-28">
      {/* En-tête sticky */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md pb-4 pt-2 -mx-4 px-4 border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notre Carte</h1>
            <p className="text-sm text-terracotta-600 font-medium">Découvrez nos spécialités</p>
          </div>
          <button
            onClick={onViewCart}
            className="relative bg-terracotta-600 text-white p-3 rounded-2xl hover:bg-terracotta-700 active:scale-95 transition-all shadow-terracotta"
          >
            <ShoppingBag className="w-6 h-6" />
            {getItemCount() > 0 && (
              <span className="absolute -top-2 -right-2 bg-gold-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold border-2 border-white animate-cart-bounce">
                {getItemCount()}
              </span>
            )}
          </button>
        </div>

        {/* Recherche */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher un plat, une boisson..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:border-transparent focus:bg-white transition-all outline-none"
          />
        </div>

        {/* Catégories */}
        <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all active:scale-95 ${
              selectedCategory === 'all' ? 'bg-terracotta-600 text-white shadow-terracotta' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Tous
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all active:scale-95 ${
                selectedCategory === cat.id ? 'bg-terracotta-600 text-white shadow-terracotta' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des articles */}
      <div className="mt-6 space-y-8 px-4">
        {groupedItems.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {searchTerm ? 'Aucun article ne correspond à votre recherche' : 'Le menu est vide pour le moment'}
            </p>
          </div>
        ) : (
          groupedItems.map((category) => (
            <div key={category.id} className="animate-fade-in">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                {category.name}
                <span className="text-xs font-semibold text-terracotta-600 bg-terracotta-50 px-2 py-1 rounded-full">
                  {category.items.length}
                </span>
              </h2>
              
              <div className="grid grid-cols-1 gap-4">
                {category.items.map((item) => {
                  const inCart = items.find((i) => i.id === item.id);
                  const isFav = favorites.includes(item.id);

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl shadow-soft border border-gray-100 p-4 hover:shadow-card transition-all active:scale-[0.99] group relative overflow-hidden"
                    >
                      {/* Badge Favori */}
                      <button 
                        onClick={() => toggleFavorite(item.id)}
                        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-sm active:scale-90 transition"
                      >
                        <Heart className={`w-5 h-5 ${isFav ? 'fill-terracotta-600 text-terracotta-600' : 'text-gray-400'}`} />
                      </button>

                      <div className="flex justify-between items-start gap-4 pr-10">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 text-lg group-hover:text-terracotta-600 transition-colors">
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="text-sm text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{item.description}</p>
                          )}
                          <p className="text-xl font-bold text-terracotta-700 mt-3">
                            {item.price.toLocaleString()} <span className="text-sm font-medium text-gray-500">f CFA</span>
                          </p>
                        </div>
                        
                        <div className="flex flex-col items-end justify-end h-full pb-1">
                          {inCart ? (
                            <div className="flex items-center gap-3 bg-terracotta-50 rounded-xl p-1.5 border border-terracotta-100">
                              <button 
                                onClick={() => updateQuantity(item.id, inCart.quantity - 1)}
                                className="w-8 h-8 bg-white text-terracotta-600 rounded-lg flex items-center justify-center shadow-sm active:scale-90 transition"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-6 text-center font-bold text-terracotta-800">{inCart.quantity}</span>
                              <button
                                onClick={() => handleAddToCart(item)}
                                className="w-8 h-8 bg-terracotta-600 text-white rounded-lg flex items-center justify-center shadow-sm active:scale-90 transition"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddToCart(item)}
                              className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-800 active:scale-95 transition-all shadow-md flex items-center gap-2"
                            >
                              <Plus className="w-4 h-4" /> Ajouter
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
