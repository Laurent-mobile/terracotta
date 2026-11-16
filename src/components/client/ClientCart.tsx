// src/components/client/ClientCart.tsx
import React, { useState } from 'react';
import { useClientCart } from '../../contexts/ClientCartContext';
import { X, Minus, Plus, Trash2, ArrowLeft, ShoppingBag, Gift, AlertCircle, Check, Package, Truck } from 'lucide-react';
import toast from 'react-hot-toast';

interface ClientCartProps {
    onCheckout: () => void;
    onBack: () => void;
}

export default function ClientCart({ onCheckout, onBack }: ClientCartProps) {
    const { items, removeItem, updateQuantity, getTotal, getItemCount, clearCart } = useClientCart();
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // 🎯 Type de commande (À emporter ou Livraison)
    const [orderType, setOrderType] = useState<'takeaway' | 'delivery'>('takeaway');

    // 🎯 Seuils
    const FREE_DELIVERY_THRESHOLD = 15000;
    const DELIVERY_FEE = 1500;
    const total = getTotal();
    const deliveryFee = orderType === 'delivery' ? DELIVERY_FEE : 0;
    const finalTotal = total + deliveryFee;

    // Barre de progression (s'adapte selon le type)
    const progressPercent = Math.min((total / FREE_DELIVERY_THRESHOLD) * 100, 100);
    const remainingForFreeDelivery = Math.max(FREE_DELIVERY_THRESHOLD - total, 0);

    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-cream-50 flex flex-col">
                <div className="p-4">
                    <button
                        onClick={onBack}
                        className="flex items-center text-gray-600 hover:text-terracotta-700 mb-6 font-medium active:scale-95 transition"
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Retour au menu
                    </button>

                    <div className="text-center py-16 bg-white rounded-3xl shadow-soft border border-gray-100 animate-fade-in">
                        <div className="w-24 h-24 bg-cream-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ShoppingBag className="w-12 h-12 text-terracotta-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Votre panier est vide</h2>
                        <p className="text-gray-500 mb-6">
                            Découvrez notre menu et ajoutez vos plats préférés
                        </p>
                        <button
                            onClick={onBack}
                            className="bg-terracotta-600 text-white px-8 py-3.5 rounded-2xl font-semibold hover:bg-terracotta-700 active:scale-95 transition-all shadow-terracotta"
                        >
                            Voir le menu
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const handleRemoveItem = (item: any) => {
        removeItem(item.id);
        toast.success(`${item.name} retiré du panier`, { icon: '🗑️' });
    };

    const handleClearCart = () => {
        clearCart();
        setShowClearConfirm(false);
        toast.success('Panier vidé', { icon: '🗑️' });
    };

    const handleQuantityChange = (itemId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            const item = items.find(i => i.id === itemId);
            if (item) handleRemoveItem(item);
        } else {
            updateQuantity(itemId, newQuantity);
        }
    };

    return (
        <div className="min-h-screen bg-cream-50 pb-[280px]"> {/* 🔥 Augmenté pour libérer l'espace du bouton */}
            {/* En-tête */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="p-4 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="flex items-center text-gray-600 hover:text-terracotta-700 font-medium active:scale-95 transition"
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Retour
                    </button>
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-terracotta-600" />
                        Mon Panier
                        <span className="text-sm font-normal text-gray-500">({getItemCount()})</span>
                    </h1>
                    <button
                        onClick={() => setShowClearConfirm(true)}
                        className="text-red-600 hover:text-red-700 p-2 rounded-full hover:bg-red-50 active:scale-95 transition"
                        title="Vider le panier"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* 🔥 NOUVEAU : Sélecteur de type de commande */}
                <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-4">
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Package className="w-5 h-5 text-terracotta-600" />
                        Mode de réception
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setOrderType('takeaway')}
                            className={`p-4 border-2 rounded-2xl text-center transition-all active:scale-95 ${
                                orderType === 'takeaway'
                                    ? 'border-terracotta-600 bg-terracotta-50'
                                    : 'border-gray-200 bg-gray-50'
                            }`}
                        >
                            <Package className={`w-6 h-6 mx-auto mb-2 ${
                                orderType === 'takeaway' ? 'text-terracotta-600' : 'text-gray-400'
                            }`} />
                            <span className={`font-bold block ${
                                orderType === 'takeaway' ? 'text-terracotta-700' : 'text-gray-700'
                            }`}>
                                À emporter
                            </span>
                            <span className="block text-xs text-green-600 mt-1 font-semibold">
                                ✓ Gratuit
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setOrderType('delivery')}
                            className={`p-4 border-2 rounded-2xl text-center transition-all active:scale-95 ${
                                orderType === 'delivery'
                                    ? 'border-terracotta-600 bg-terracotta-50'
                                    : 'border-gray-200 bg-gray-50'
                            }`}
                        >
                            <Truck className={`w-6 h-6 mx-auto mb-2 ${
                                orderType === 'delivery' ? 'text-terracotta-600' : 'text-gray-400'
                            }`} />
                            <span className={`font-bold block ${
                                orderType === 'delivery' ? 'text-terracotta-700' : 'text-gray-700'
                            }`}>
                                Livraison
                            </span>
                            <span className="block text-xs text-gray-500 mt-1">
                                +{DELIVERY_FEE.toLocaleString()} f CFA
                            </span>
                        </button>
                    </div>
                </div>

                {/* 🎯 Barre de progression livraison gratuite (seulement si livraison) */}
                {orderType === 'delivery' && total < FREE_DELIVERY_THRESHOLD && (
                    <div className="bg-gradient-to-r from-terracotta-50 to-cream-100 rounded-2xl p-4 border border-terracotta-100 animate-fade-in">
                        <div className="flex items-center gap-2 mb-2">
                            <Gift className="w-5 h-5 text-terracotta-600" />
                            <p className="text-sm font-semibold text-terracotta-800">
                                Plus que {remainingForFreeDelivery.toLocaleString()} f CFA pour la livraison gratuite !
                            </p>
                        </div>
                        <div className="w-full bg-white rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-terracotta-500 to-terracotta-700 h-2.5 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                )}

                {orderType === 'delivery' && total >= FREE_DELIVERY_THRESHOLD && (
                    <div className="bg-green-50 rounded-2xl p-4 border border-green-200 animate-fade-in">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                <Check className="w-5 h-5 text-white" />
                            </div>
                            <p className="text-sm font-semibold text-green-800">
                                🎉 Livraison gratuite appliquée !
                            </p>
                        </div>
                    </div>
                )}

                {/* Liste des articles */}
                <div className="space-y-3">
                    {items.map((item, index) => (
                        <div
                            key={item.id}
                            className="bg-white rounded-2xl shadow-soft border border-gray-100 p-4 animate-fade-in hover:shadow-card transition-all"
                            style={{ animationDelay: `${index * 0.05}s` }}
                        >
                            <div className="flex items-start gap-3">
                                {/* Image de l'article */}
                                {item.image ? (
                                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 rounded-xl bg-cream-100 flex items-center justify-center shrink-0">
                                        <span className="text-3xl">🍽️</span>
                                    </div>
                                )}

                                {/* Infos article */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-gray-900 truncate">
                                                {item.name}
                                            </h3>
                                            {item.category && (
                                                <span className="inline-block mt-1 text-xs font-medium text-terracotta-600 bg-terracotta-50 px-2 py-0.5 rounded-full">
                                                    {item.category}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleRemoveItem(item)}
                                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-full active:scale-90 transition"
                                            title="Supprimer"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Prix et quantité */}
                                    <div className="flex items-center justify-between mt-3">
                                        <p className="text-lg font-bold text-terracotta-700">
                                            {(item.price * item.quantity).toLocaleString()}
                                            <span className="text-xs font-medium text-gray-500 ml-1">f CFA</span>
                                        </p>

                                        {/* Contrôle quantité */}
                                        <div className="flex items-center gap-1 bg-cream-50 rounded-xl p-1 border border-cream-200">
                                            <button
                                                onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                                className="w-8 h-8 bg-white text-terracotta-600 rounded-lg flex items-center justify-center shadow-sm hover:bg-red-50 hover:text-red-600 active:scale-90 transition"
                                            >
                                                {item.quantity === 1 ? (
                                                    <Trash2 className="w-4 h-4" />
                                                ) : (
                                                    <Minus className="w-4 h-4" />
                                                )}
                                            </button>
                                            <span className="w-8 text-center font-bold text-gray-900">
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                                className="w-8 h-8 bg-terracotta-600 text-white rounded-lg flex items-center justify-center shadow-sm hover:bg-terracotta-700 active:scale-90 transition"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Prix unitaire */}
                                    <p className="text-xs text-gray-500 mt-1">
                                        {item.price.toLocaleString()} f CFA × {item.quantity}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Résumé de la commande */}
                <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-terracotta-600" />
                        Résumé
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Sous-total ({getItemCount()} article{getItemCount() > 1 ? 's' : ''})</span>
                            <span className="font-medium">{total.toLocaleString()} f CFA</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">
                                {orderType === 'delivery' ? 'Livraison' : 'À emporter'}
                            </span>
                            <span className={`font-medium ${
                                orderType === 'takeaway' ? 'text-green-600' :
                                total >= FREE_DELIVERY_THRESHOLD ? 'text-green-600 line-through' : ''
                            }`}>
                                {orderType === 'takeaway' ? 'Gratuit' :
                                 total >= FREE_DELIVERY_THRESHOLD ? 'Gratuite' :
                                 `${DELIVERY_FEE.toLocaleString()} f CFA`}
                            </span>
                        </div>
                        <div className="border-t border-gray-200 pt-3 mt-3">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-gray-900">Total</span>
                                <span className="text-2xl font-bold text-terracotta-700">
                                    {finalTotal.toLocaleString()}
                                    <span className="text-sm font-medium text-gray-500 ml-1">f CFA</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 🔥 Barre sticky de validation - AVEC PADDING ADAPTÉ */}
            <div className="fixed bottom-[72px] left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-40"> {/* 🔥 bottom-[72px] au lieu de bottom-0 */}
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-sm text-gray-600">Total à payer</p>
                            <p className="text-2xl font-bold text-terracotta-700">
                                {finalTotal.toLocaleString()}
                                <span className="text-sm font-medium text-gray-500 ml-1">f CFA</span>
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500">{getItemCount()} article{getItemCount() > 1 ? 's' : ''}</p>
                            {orderType === 'delivery' && total < FREE_DELIVERY_THRESHOLD && (
                                <p className="text-xs text-terracotta-600 font-medium">
                                    +{remainingForFreeDelivery.toLocaleString()} f pour livraison gratuite
                                </p>
                            )}
                            {orderType === 'takeaway' && (
                                <p className="text-xs text-green-600 font-medium">
                                    ✓ Retrait au restaurant
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onCheckout}
                        className="w-full bg-terracotta-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-terracotta-700 active:scale-[0.98] transition-all shadow-terracotta flex items-center justify-center gap-2"
                    >
                        Passer la commande
                        <ArrowLeft className="w-5 h-5 rotate-180" />
                    </button>
                </div>
            </div>

            {/* Modal de confirmation pour vider le panier */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-up">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                            Vider le panier ?
                        </h3>
                        <p className="text-gray-600 text-center mb-6">
                            Tous les articles seront supprimés. Cette action est irréversible.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowClearConfirm(false)}
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleClearCart}
                                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 active:scale-95 transition"
                            >
                                Vider
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
