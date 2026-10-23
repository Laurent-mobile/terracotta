// src/components/client/ClientOrderTracking.tsx
import React, { useState, useEffect } from 'react';
import { useClientOrders } from '../../hooks/useClientOrders';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, Clock, Package, Truck, Home, XCircle, ArrowLeft } from 'lucide-react';

interface ClientOrderTrackingProps {
    orderNumber: string;
    onBack: () => void;
}

export default function ClientOrderTracking({ orderNumber, onBack }: ClientOrderTrackingProps) {
    const { user } = useAuth();
    const { orders, trackOrder } = useClientOrders();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Trouver la commande dans la liste
        const found = orders.find(o => o.order_number === orderNumber);
        if (found) {
            setOrder(found);
            setLoading(false);
        } else {
            // Vérifier périodiquement
            const interval = setInterval(() => {
                const updated = orders.find(o => o.order_number === orderNumber);
                if (updated) {
                    setOrder(updated);
                    setLoading(false);
                    clearInterval(interval);
                }
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [orders, orderNumber]);

    // Suivi en temps réel
    useEffect(() => {
        if (!order?.id) return;

        const unsubscribe = trackOrder(order.id, (updatedOrder) => {
            setOrder(updatedOrder);
        });

        return () => unsubscribe();
    }, [order?.id, trackOrder]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-4 flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement de la commande...</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="max-w-4xl mx-auto p-4">
                <button onClick={onBack} className="flex items-center text-blue-600 hover:text-blue-800 mb-6">
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Retour
                </button>
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <p className="text-gray-600">Commande non trouvée</p>
                </div>
            </div>
        );
    }

    const getStatusInfo = (status: string) => {
        const statusMap: Record<string, { label: string; icon: any; color: string }> = {
            pending: { label: 'En attente', icon: Clock, color: 'bg-yellow-500' },
            confirmed: { label: 'Confirmée', icon: CheckCircle, color: 'bg-blue-500' },
            preparing: { label: 'En préparation', icon: Package, color: 'bg-purple-500' },
            ready: { label: 'Prête', icon: CheckCircle, color: 'bg-green-500' },
            completed: { label: 'Terminée', icon: Home, color: 'bg-emerald-500' },
            cancelled: { label: 'Annulée', icon: XCircle, color: 'bg-red-500' }
        };
        return statusMap[status] || statusMap.pending;
    };

    const statusInfo = getStatusInfo(order.status);

    return (
        <div className="max-w-4xl mx-auto p-4">
            <button onClick={onBack} className="flex items-center text-blue-600 hover:text-blue-800 mb-6">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Retour
            </button>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                {/* En-tête */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">📦 Suivi de commande</h1>
                        <p className="text-gray-600">N° {order.order_number}</p>
                    </div>
                    <div className={`px-4 py-2 rounded-full text-sm font-medium text-white ${statusInfo.color}`}>
                        {statusInfo.label}
                    </div>
                </div>

                {/* Statut */}
                <div className="mb-8">
                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                        <statusInfo.icon className="w-8 h-8 text-gray-600" />
                        <div>
                            <p className="font-medium text-gray-900">Statut actuel</p>
                            <p className="text-gray-600">{statusInfo.label}</p>
                        </div>
                    </div>
                </div>

                {/* Timeline */}
                <div className="mb-8">
                    <h3 className="font-semibold text-gray-900 mb-4">Progression</h3>
                    <div className="space-y-3">
                        {[
                            { status: 'pending', label: 'Commande reçue' },
                            { status: 'confirmed', label: 'Commande confirmée' },
                            { status: 'preparing', label: 'En préparation' },
                            { status: 'ready', label: 'Commande prête' },
                            { status: 'completed', label: 'Terminée' }
                        ].map((step, index) => {
                            const isCompleted = order.status === 'completed' ||
                                ['pending', 'confirmed', 'preparing', 'ready', 'completed'].indexOf(order.status) >= index;
                            const isCurrent = order.status === step.status;

                            return (
                                <div key={index} className="flex items-center space-x-4">
                                    <div className="relative">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                                            }`}>
                                            {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                        </div>
                                        {index < 4 && (
                                            <div className={`absolute top-8 left-1/2 transform -translate-x-1/2 w-0.5 h-8 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'
                                                }`}></div>
                                        )}
                                    </div>
                                    <div>
                                        <p className={`font-medium ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                                            {step.label}
                                        </p>
                                        {isCurrent && (
                                            <p className="text-sm text-blue-600">En cours...</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Détails de la commande */}
                <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Détails</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500">Type</p>
                                <p className="font-medium capitalize">{order.order_type.replace('_', ' ')}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Date</p>
                                <p className="font-medium">{new Date(order.created_at).toLocaleDateString('fr-FR')}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Client</p>
                                <p className="font-medium">{order.customer_name}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Téléphone</p>
                                <p className="font-medium">{order.customer_phone}</p>
                            </div>
                        </div>

                        {order.delivery_address && (
                            <div>
                                <p className="text-gray-500 text-sm">Adresse de livraison</p>
                                <p className="font-medium">{order.delivery_address}</p>
                            </div>
                        )}

                        <div className="border-t border-gray-200 pt-4">
                            <h4 className="font-medium text-gray-900 mb-2">Articles</h4>
                            <div className="space-y-2">
                                {order.items.map((item: any, index: number) => (
                                    <div key={index} className="flex justify-between text-sm">
                                        <span>{item.quantity}x {item.name}</span>
                                        <span>{item.total.toLocaleString()} f CFA</span>
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-gray-200 mt-3 pt-3">
                                <div className="flex justify-between font-bold">
                                    <span>Total</span>
                                    <span className="text-blue-600">{order.total_amount.toLocaleString()} f CFA</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
