// src/components/client/ClientCart.tsx
import React from 'react';
import { useClientCart } from '../../contexts/ClientCartContext';
import { X, Minus, Plus, Trash2, ArrowLeft, ShoppingBag } from 'lucide-react';

interface ClientCartProps {
    onCheckout: () => void;
    onBack: () => void;
}

export default function ClientCart({ onCheckout, onBack }: ClientCartProps) {
    const { items, removeItem, updateQuantity, getTotal, getItemCount, clearCart } = useClientCart();

    if (items.length === 0) {
        return (
            <div className="max-w-4xl mx-auto p-4">
                <button onClick={onBack} className="flex items-center text-blue-600 hover:text-blue-800 mb-6">
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Retour au menu
                </button>
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                    <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">Votre panier est vide</p>
                    <button
                        onClick={onBack}
                        className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
                    >
                        Voir le menu
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 pb-24">
            {/* En-tête */}
            <div className="flex items-center justify-between mb-6">
                <button onClick={onBack} className="flex items-center text-blue-600 hover:text-blue-800">
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Retour
                </button>
                <h1 className="text-2xl font-bold text-gray-900">🛒 Mon Panier</h1>
                <button
                    onClick={clearCart}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                    Vider
                </button>
            </div>

            {/* Liste des articles */}
            <div className="space-y-4 mb-6">
                {items.map(item => (
                    <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                <p className="text-sm text-gray-500">
                                    {item.price.toLocaleString()} f CFA l'unité
                                </p>
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-2 py-1">
                                    <button
                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                        className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                                    <button
                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                        className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                <button
                                    onClick={() => removeItem(item.id)}
                                    className="text-red-600 hover:text-red-800 p-2"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="text-right mt-2 font-semibold text-blue-600">
                            {(item.price * item.quantity).toLocaleString()} f CFA
                        </div>
                    </div>
                ))}
            </div>

            {/* Résumé */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                        <span className="text-gray-600">Sous-total</span>
                        <span className="font-medium">{getTotal().toLocaleString()} f CFA</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">Frais de livraison</span>
                        <span className="font-medium">0 f CFA</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 mt-2">
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span className="text-blue-600">{getTotal().toLocaleString()} f CFA</span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onCheckout}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
                >
                    Passer à la validation ({getItemCount()} articles)
                </button>
            </div>
        </div>
    );
}
