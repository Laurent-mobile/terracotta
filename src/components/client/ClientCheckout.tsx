// src/components/client/ClientCheckout.tsx
import React, { useState } from 'react';
import { useClientCart } from '../../contexts/ClientCartContext';
import { useClientOrders } from '../../hooks/useClientOrders';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, User, Phone, MapPin, Truck, Package, Loader2 } from 'lucide-react';

interface ClientCheckoutProps {
    onSuccess: (orderNumber: string) => void;
    onBack: () => void;
}

export default function ClientCheckout({ onSuccess, onBack }: ClientCheckoutProps) {
    const { user } = useAuth();
    const { items, getTotal, clearCart } = useClientCart();
    const { createOrder, loading } = useClientOrders();

    const [orderType, setOrderType] = useState<'delivery' | 'takeaway'>('takeaway');
    const [customerInfo, setCustomerInfo] = useState({
        name: user?.user_metadata?.full_name || '',
        phone: user?.user_metadata?.phone || '',
        address: '',
        notes: ''
    });
    const [error, setError] = useState<string | null>(null);

    const total = getTotal();
    const deliveryFee = orderType === 'delivery' ? 1500 : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
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

        try {
            const orderData = {
                customer_name: customerInfo.name,
                customer_phone: customerInfo.phone,
                customer_email: user?.email || '',
                items: items.map(item => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.price * item.quantity
                })),
                subtotal: total,
                delivery_fee: deliveryFee,
                total_amount: total + deliveryFee,
                order_type: orderType,
                delivery_address: orderType === 'delivery' ? customerInfo.address : undefined,
                notes: customerInfo.notes || undefined
            };

            const order = await createOrder(orderData);

            // Vider le panier
            clearCart();

            // Rediriger vers le suivi
            onSuccess(order.order_number);
        } catch (err: any) {
            setError(err.message || 'Erreur lors de la création de la commande');
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 pb-24">
            {/* En-tête */}
            <button onClick={onBack} className="flex items-center text-blue-600 hover:text-blue-800 mb-6">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Retour au panier
            </button>

            <h1 className="text-2xl font-bold text-gray-900 mb-6">📝 Validation de la commande</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Type de commande */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Type de commande *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
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
                            type="button"
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
                <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Informations client</h3>

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
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Votre nom"
                                required
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
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Votre numéro"
                                required
                            />
                        </div>
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
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Votre adresse complète"
                                    required
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Instructions de livraison, allergies, etc."
                        />
                    </div>
                </div>

                {/* Résumé de la commande */}
                <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Résumé de la commande</h3>
                    <div className="space-y-2">
                        {items.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <span>{item.quantity}x {item.name}</span>
                                <span>{(item.price * item.quantity).toLocaleString()} f CFA</span>
                            </div>
                        ))}
                        <div className="border-t border-gray-200 pt-2 mt-2 space-y-1">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Sous-total</span>
                                <span>{total.toLocaleString()} f CFA</span>
                            </div>
                            {deliveryFee > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Livraison</span>
                                    <span>{deliveryFee.toLocaleString()} f CFA</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
                                <span>Total</span>
                                <span className="text-blue-600">{(total + deliveryFee).toLocaleString()} f CFA</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Erreur */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {/* Bouton de validation */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Commande en cours...
                        </>
                    ) : (
                        'Confirmer la commande'
                    )}
                </button>
            </form>
        </div>
    );
}
