// src/components/client/ClientMenu.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useClientCart } from '../../contexts/ClientCartContext';
import { Search, Plus, Minus, ShoppingBag, Star } from 'lucide-react';

interface MenuItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    category_id: string;
    is_available: boolean;
    image_url?: string;
    category?: {
        name: string;
    };
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
    const { addItem, getItemCount, items } = useClientCart();

    useEffect(() => {
        loadMenu();
    }, []);

    const loadMenu = async () => {
        try {
            setLoading(true);

            const [menuRes, categoriesRes] = await Promise.all([
                supabase
                    .from('pos_menus')
                    .select(`
            *,
            category:pos_categories(name)
          `)
                    .eq('is_available', true)
                    .eq('is_active', true)
                    .order('name'),
                supabase
                    .from('pos_categories')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order')
            ]);

            if (menuRes.error) throw menuRes.error;
            if (categoriesRes.error) throw categoriesRes.error;

            setMenuItems(menuRes.data || []);
            setCategories(categoriesRes.data || []);
        } catch (error) {
            console.error('Erreur chargement menu:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const groupedItems = categories
        .map(cat => ({
            ...cat,
            items: filteredItems.filter(item => item.category_id === cat.id)
        }))
        .filter(cat => cat.items.length > 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement du menu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 pb-24">
            {/* En-tête */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">🍽️ Notre Menu</h1>
                <button
                    onClick={onViewCart}
                    className="relative bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition shadow-lg"
                >
                    <ShoppingBag className="w-6 h-6" />
                    {getItemCount() > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                            {getItemCount()}
                        </span>
                    )}
                </button>
            </div>

            {/* Recherche */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Rechercher un plat..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            {/* Catégories */}
            <div className="flex overflow-x-auto gap-2 mb-6 pb-2">
                <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${selectedCategory === 'all'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                >
                    Tous
                </button>
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${selectedCategory === cat.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Liste des articles */}
            {groupedItems.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                    <p className="text-gray-600">
                        {searchTerm ? 'Aucun article trouvé' : 'Le menu est vide pour le moment'}
                    </p>
                </div>
            ) : (
                groupedItems.map(category => (
                    <div key={category.id} className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">{category.name}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {category.items.map(item => {
                                const inCart = items.find(i => i.id === item.id);
                                return (
                                    <div
                                        key={item.id}
                                        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                                {item.description && (
                                                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                                                )}
                                                <p className="text-lg font-bold text-blue-600 mt-2">
                                                    {item.price.toLocaleString()} f CFA
                                                </p>
                                            </div>
                                            <div className="flex items-center space-x-2 ml-4">
                                                {inCart ? (
                                                    <div className="flex items-center space-x-2 bg-blue-50 rounded-lg px-2 py-1">
                                                        <button
                                                            onClick={() => {
                                                                // La quantité sera gérée via le panier
                                                            }}
                                                            className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200"
                                                        >
                                                            <Minus className="w-4 h-4" />
                                                        </button>
                                                        <span className="w-6 text-center font-semibold">{inCart.quantity}</span>
                                                        <button
                                                            onClick={() => addItem(item)}
                                                            className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center hover:bg-green-200"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => addItem(item)}
                                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
                                                    >
                                                        Ajouter
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
    );
}
