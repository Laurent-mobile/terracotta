// src/components/mobile/ClientOrderView.tsx
import { useState, useEffect } from 'react';
import { onlineOrdersService, OnlineOrderItem } from '../../services/onlineOrders';
import {
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    User,
    Phone,
    MapPin,
    CreditCard,
    Smartphone,
    CheckCircle,
    Clock,
    XCircle,
    Truck,
    Package,
    Home,
    AlertCircle
} from 'lucide-react';

interface MenuItem {
    id: string;
    name: string;
    price: number;
    description?: string;
    category_id: string;
    is_available: boolean;
    category?: {
        name: string;
    };
}

interface ClientOrderViewProps {
    onOrderPlaced?: (orderNumber: string) => void;
    restaurantName?: string;
}

export default function ClientOrderView({ onOrderPlaced, restaurantName = 'Restaurant' }: ClientOrderViewProps) {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState<'menu' | 'checkout' | 'confirmation'>('menu');
    const [orderType, setOrderType] = useState<'delivery' | 'takeaway'>('takeaway');
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        notes: ''
    });
    const [orderNumber, setOrderNumber] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadMenu();
    }, []);

    const loadMenu = async () => {
        try {
            const [menuRes, categoriesRes] = await Promise.all([
                supabase
                    .from('pos_menus')
                    .select(`
            *,
            category:pos_categories(name)
          `)
                    .eq('is_available', true)
                    .eq('is_active', true),
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
            setError('Impossible de charger le menu');
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(c => c.item.id === item.id);
            if (existing) {
                return prev.map(c =>
                    c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
                );
            }
            return [...prev, { item, quantity: 1 }];
        });
    };

    const removeFromCart = (itemId: string) => {
        setCart(prev => {
            const existing = prev.find(c => c.item.id === itemId);
            if (existing && existing.quantity > 1) {
                return prev.map(c =>
                    c.item.id === itemId ? { ...c, quantity: c.quantity - 1 } : c
                );
            }
            return prev.filter(c => c.item.id !== itemId);
        });
    };

    const getTotal = () => {
        return cart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0);
    };

    const getDeliveryFee = () => {
        return orderType === 'delivery' ? 1500 : 0;
    };

    const handleSubmitOrder = async () => {
        // Validation
        if (cart.length === 0) {
            setError('Votre panier est vide');
            return;
        }

        if (!customerInfo.name.trim()) {
            setError('Veuillez entrer votre nom');
            return;
        }

        if (!customerInfo.phone.trim()) {
            setError('Veuillez entrer votre numéro de téléphone');
            return;
        }

        if (orderType === 'delivery' && !customerInfo.address.trim()) {
            setError('Veuillez entrer votre adresse de livraison');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const items: OnlineOrderItem[] = cart.map(c => ({
                id: c.item.id,
                name: c.item.name,
                quantity: c.quantity,
                price: c.item.price,
                total: c.item.price * c.quantity,
                notes: ''
            }));

            const subtotal = getTotal();
            const deliveryFee = getDeliveryFee();

            const order = await onlineOrdersService.createOrder({
                customer_name: customerInfo.name,
                customer_phone: customerInfo.phone,
                customer_email: customerInfo.email || undefined,
                items,
                subtotal,
                delivery_fee: deliveryFee,
                total_amount: subtotal + deliveryFee,
                order_type: orderType,
                delivery_address: orderType === 'delivery' ? customerInfo.address : undefined,
            });

            setOrderNumber(order.order_number);
            setStep('confirmation');
            setCart([]);

            if (onOrderPlaced) {
                onOrderPlaced(order.order_number);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredItems = menuItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groupedItems = categories
        .map(cat => ({
            ...cat,
            items: filteredItems.filter(item => item.category_id === cat.id)
        }))
        .filter(cat => cat.items.length > 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement du menu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* En-tête */}
            <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{restaurantName}</h1>
                            <p className="text-sm text-gray-500">Commandez en ligne</p>
                        </div>
                        {step === 'menu' && (
                            <button
                                onClick={() => setStep('checkout')}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition"
                            >
                                <ShoppingCart className="w-5 h-5" />
                                <span>Panier ({cart.length})</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center">
                            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                            <p className="text-red-700">{error}</p>
                            <button
                                onClick={() => setError(null)}
                                className="ml-auto text-red-500 hover:text-red-700"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}

                {step === 'menu' && (
                    <div>
                        {/* Barre de recherche */}
                        <div className="mb-6">
                            <input
                                type="text"
                                placeholder="Rechercher un plat..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Menu */}
                        <div className="space-y-8">
                            {groupedItems.map(category => (
                                <div key={category.id}>
                                    <h2 className="text-xl font-bold text-gray-900 mb-4">{category.name}</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {category.items.map(item => {
                                            const inCart = cart.find(c => c.item.id === item.id);
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                            <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                                            {item.description && (
                                                                <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                                                            )}
                                                            <p className="text-lg font-bold text-blue-600 mt-2">
                                                                {item.price.toLocaleString()} f CFA
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center space-x-2 ml-4">
                                                            {inCart ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => removeFromCart(item.id)}
                                                                        className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200"
                                                                    >
                                                                        <Minus className="w-4 h-4" />
                                                                    </button>
                                                                    <span className="w-6 text-center font-semibold">{inCart.quantity}</span>
                                                                    <button
                                                                        onClick={() => addToCart(item)}
                                                                        className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center hover:bg-green-200"
                                                                    >
                                                                        <Plus className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <button
                                                                    onClick={() => addToCart(item)}
                                                                    className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700"
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {groupedItems.length === 0 && (
                                <div className="text-center py-12">
                                    <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-600">Aucun article trouvé</p>
                                </div>
                            )}
                        </div>

                        {/* Panier flottant (mobile) */}
                        {cart.length > 0 && (
                            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg md:hidden">
                                <div className="flex items-center justify-between max-w-7xl mx-auto">
                                    <div>
                                        <p className="font-semibold text-gray-900">{cart.length} article(s)</p>
                                        <p className="text-blue-600 font-bold">{getTotal().toLocaleString()} f CFA</p>
                                    </div>
                                    <button
                                        onClick={() => setStep('checkout')}
                                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
                                    >
                                        Commander
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {step === 'checkout' && (
                    <div className="max-w-2xl mx-auto">
                        <button
                            onClick={() => setStep('menu')}
                            className="text-blue-600 hover:text-blue-800 mb-6 flex items-center"
                        >
                            ← Retour au menu
                        </button>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Validation de la commande</h2>

                            {/* Type de commande */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Type de commande *
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setOrderType('takeaway')}
                                        className={`p-4 border-2 rounded-lg text-center transition ${orderType === 'takeaway'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Package className="w-6 h-6 mx-auto mb-2" />
                                        <span className="font-medium">À emporter</span>
                                    </button>
                                    <button
                                        onClick={() => setOrderType('delivery')}
                                        className={`p-4 border-2 rounded-lg text-center transition ${orderType === 'delivery'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Truck className="w-6 h-6 mx-auto mb-2" />
                                        <span className="font-medium">Livraison</span>
                                        <span className="block text-xs text-gray-500">+1500 f CFA</span>
                                    </button>
                                </div>
                            </div>

                            {/* Informations client */}
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nom complet *
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            value={customerInfo.name}
                                            onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="Votre nom"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Téléphone *
                                    </label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="tel"
                                            value={customerInfo.phone}
                                            onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="Votre numéro"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email (optionnel)
                                    </label>
                                    <input
                                        type="email"
                                        value={customerInfo.email}
                                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="votre@email.com"
                                    />
                                </div>

                                {orderType === 'delivery' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Adresse de livraison *
                                        </label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                                            <textarea
                                                value={customerInfo.address}
                                                onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                                                rows={3}
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                placeholder="Votre adresse complète"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Instructions spéciales
                                    </label>
                                    <textarea
                                        value={customerInfo.notes}
                                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, notes: e.target.value }))}
                                        rows={2}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="Instructions de livraison, allergies, etc."
                                    />
                                </div>
                            </div>

                            {/* Résumé de la commande */}
                            <div className="border-t border-gray-200 pt-4 mb-6">
                                <h3 className="font-semibold text-gray-900 mb-3">Résumé de votre commande</h3>
                                {cart.map(c => (
                                    <div key={c.item.id} className="flex justify-between py-2 text-sm">
                                        <span>{c.quantity}x {c.item.name}</span>
                                        <span>{(c.item.price * c.quantity).toLocaleString()} f CFA</span>
                                    </div>
                                ))}
                                <div className="border-t border-gray-200 mt-3 pt-3 space-y-2">
                                    <div className="flex justify-between">
                                        <span>Sous-total</span>
                                        <span>{getTotal().toLocaleString()} f CFA</span>
                                    </div>
                                    {getDeliveryFee() > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span>Livraison</span>
                                            <span>{getDeliveryFee().toLocaleString()} f CFA</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
                                        <span>Total</span>
                                        <span className="text-blue-600">{(getTotal() + getDeliveryFee()).toLocaleString()} f CFA</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSubmitOrder}
                                disabled={isSubmitting}
                                className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                                        Envoi en cours...
                                    </>
                                ) : (
                                    'Confirmer la commande'
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'confirmation' && (
                    <div className="max-w-md mx-auto text-center py-12">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle className="w-10 h-10 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Commande confirmée !</h2>
                            <p className="text-gray-600 mb-4">
                                Votre commande a été reçue avec succès.
                            </p>
                            <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                <p className="text-sm text-gray-500">Numéro de commande</p>
                                <p className="text-xl font-bold text-blue-600">{orderNumber}</p>
                            </div>
                            <div className="space-y-2 text-sm text-gray-600 mb-6">
                                <p>📱 Vous recevrez une notification lorsque votre commande sera prête.</p>
                                <p>⏱️ Temps d'attente estimé : 15-20 minutes</p>
                            </div>
                            <button
                                onClick={() => {
                                    setStep('menu');
                                    setCustomerInfo({ name: '', phone: '', email: '', address: '', notes: '' });
                                    setOrderNumber('');
                                }}
                                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
                            >
                                Nouvelle commande
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
