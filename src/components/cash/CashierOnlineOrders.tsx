// src/components/cash/CashierOnlineOrders.tsx
import { useState } from 'react';
import { useOnlineOrders } from '../../hooks/useOnlineOrders';
import {
    ShoppingBag,
    Clock,
    CheckCircle,
    XCircle,
    Package,
    Truck,
    User,
    Phone,
    MapPin,
    CreditCard,
    Smartphone,
    Bell,
    BellOff,
    RefreshCw,
    Eye,
    Printer,
    DollarSign,
    AlertCircle
} from 'lucide-react';

// Fonction de formatage de date simple (remplace date-fns)
const formatDate = (dateString: string) => {
    try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
        return dateString;
    }
};

// Fonction pour formater l'heure uniquement
const formatTime = (dateString: string) => {
    try {
        const date = new Date(dateString);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch {
        return '';
    }
};

// Fonction pour obtenir le nom du jour
const getDayName = (dateString: string) => {
    try {
        const date = new Date(dateString);
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        return days[date.getDay()];
    } catch {
        return '';
    }
};

// Fonction pour obtenir le nom du mois
const getMonthName = (dateString: string) => {
    try {
        const date = new Date(dateString);
        const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
        return months[date.getMonth()];
    } catch {
        return '';
    }
};

function CashierOnlineOrders() {
    const {
        orders,
        pendingOrders,
        notifications,
        unreadCount,
        loading,
        error,
        confirmOrder,
        markReady,
        completeOrder,
        markNotificationRead,
        loadOrders
    } = useOnlineOrders();

    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [showNotifications, setShowNotifications] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card'>('cash');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [currentProcessing, setCurrentProcessing] = useState<string | null>(null);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">En attente</span>;
            case 'confirmed':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Confirmée</span>;
            case 'preparing':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">En préparation</span>;
            case 'ready':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Prête</span>;
            case 'completed':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Terminée</span>;
            case 'cancelled':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Annulée</span>;
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
        }
    };

    const getOrderTypeIcon = (type: string) => {
        return type === 'delivery' ? <Truck className="w-4 h-4" /> : <Package className="w-4 h-4" />;
    };

    const getOrderTypeLabel = (type: string) => {
        return type === 'delivery' ? 'Livraison' : 'À emporter';
    };

    const handleConfirm = async (orderId: string) => {
        setCurrentProcessing(orderId);
        try {
            const success = await confirmOrder(orderId);
            if (success) {
                // ✅ FORCER LE RECHARGEMENT DES COMMANDES
                await loadOrders();
                // ✅ FERMER LE MODAL SI OUVERT
                setSelectedOrder(null);
                // ✅ AFFICHER UNE CONFIRMATION
                alert('✅ Commande confirmée avec succès !');
            }
        } catch (error) {
            console.error('Erreur confirmation:', error);
            alert('❌ Erreur lors de la confirmation');
        } finally {
            setCurrentProcessing(null);
        }
    };

    const handleMarkReady = async (orderId: string) => {
        setCurrentProcessing(orderId);
        const success = await markReady(orderId);
        setCurrentProcessing(null);
        if (success) {
            setSelectedOrder(null);
        }
    };

    const handleComplete = async (orderId: string) => {
        setCurrentProcessing(orderId);
        const success = await completeOrder(orderId, paymentMethod);
        setCurrentProcessing(null);
        if (success) {
            setShowPaymentModal(false);
            setSelectedOrder(null);
        }
    };

    const openPaymentModal = (order: any) => {
        setSelectedOrder(order);
        setShowPaymentModal(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement des commandes...</p>
                </div>
            </div>
        );
    }

    const filteredOrders = orders || [];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* En-tête avec notifications */}
            <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                                <ShoppingBag className="w-6 h-6 mr-2 text-blue-600" />
                                Commandes en ligne
                            </h1>
                            <p className="text-sm text-gray-500">
                                {pendingOrders.length} commande(s) en attente
                            </p>
                        </div>
                        <div className="flex items-center space-x-4">
                            {/* Notifications */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowNotifications(!showNotifications)}
                                    className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                                >
                                    {unreadCount > 0 ? (
                                        <Bell className="w-6 h-6" />
                                    ) : (
                                        <BellOff className="w-6 h-6" />
                                    )}
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>

                                {showNotifications && (
                                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-20">
                                        <div className="p-3 border-b border-gray-200 font-semibold text-gray-900">
                                            Notifications
                                        </div>
                                        {notifications.length === 0 ? (
                                            <div className="p-4 text-center text-gray-500">
                                                Aucune notification
                                            </div>
                                        ) : (
                                            notifications.slice(0, 10).map((n: any) => (
                                                <div
                                                    key={n.id}
                                                    className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${n.read ? 'opacity-70' : 'bg-blue-50'
                                                        }`}
                                                    onClick={() => {
                                                        markNotificationRead(n.id);
                                                    }}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <p className="font-medium text-sm text-gray-900">{n.title}</p>
                                                            <p className="text-sm text-gray-600">{n.message}</p>
                                                            <p className="text-xs text-gray-400 mt-1">
                                                                {formatDate(n.created_at)}
                                                            </p>
                                                        </div>
                                                        {!n.read && (
                                                            <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1"></span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => window.location.reload()}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                                title="Rafraîchir"
                            >
                                <RefreshCw className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center">
                            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                            <p className="text-red-700">{error}</p>
                        </div>
                    </div>
                )}

                {/* Commandes en attente */}
                {pendingOrders.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <Clock className="w-5 h-5 mr-2 text-yellow-500" />
                            Commandes en attente ({pendingOrders.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendingOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className="bg-white rounded-lg shadow-sm border border-yellow-200 p-4 hover:shadow-md transition"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="font-bold text-gray-900">{order.order_number}</p>
                                            <div className="flex items-center space-x-2 mt-1">
                                                {getOrderTypeIcon(order.order_type)}
                                                <span className="text-sm text-gray-600">
                                                    {getOrderTypeLabel(order.order_type)}
                                                </span>
                                            </div>
                                        </div>
                                        {getStatusBadge(order.status)}
                                    </div>

                                    <div className="space-y-2 mb-3">
                                        <div className="flex items-center text-sm">
                                            <User className="w-4 h-4 text-gray-400 mr-2" />
                                            <span>{order.customer_name}</span>
                                        </div>
                                        <div className="flex items-center text-sm">
                                            <Phone className="w-4 h-4 text-gray-400 mr-2" />
                                            <span>{order.customer_phone}</span>
                                        </div>
                                        {order.order_type === 'delivery' && order.delivery_address && (
                                            <div className="flex items-start text-sm">
                                                <MapPin className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                                                <span className="text-gray-600">{order.delivery_address}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t border-gray-200 pt-3 mb-3">
                                        <div className="space-y-1">
                                            {order.items.slice(0, 3).map((item: any, index: number) => (
                                                <div key={index} className="flex justify-between text-sm">
                                                    <span>{item.quantity}x {item.name}</span>
                                                    <span>{item.total.toLocaleString()} f CFA</span>
                                                </div>
                                            ))}
                                            {order.items.length > 3 && (
                                                <p className="text-xs text-gray-500">
                                                    +{order.items.length - 3} autre(s) article(s)
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center border-t border-gray-200 pt-3">
                                        <div>
                                            <p className="text-sm text-gray-500">Total</p>
                                            <p className="font-bold text-blue-600">
                                                {order.total_amount.toLocaleString()} f CFA
                                            </p>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => setSelectedOrder(order)}
                                                className="text-blue-600 hover:text-blue-800 px-3 py-1 rounded-lg text-sm border border-blue-200 hover:bg-blue-50 transition"
                                            >
                                                <Eye className="w-4 h-4 inline mr-1" />
                                                Voir
                                            </button>
                                            <button
                                                onClick={() => handleConfirm(order.id!)}
                                                disabled={currentProcessing === order.id}
                                                className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition"
                                            >
                                                {currentProcessing === order.id ? '...' : 'Valider'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Toutes les commandes */}
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Toutes les commandes ({filteredOrders.length})
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commande</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Articles</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-medium text-gray-900">{order.order_number}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{order.customer_name}</div>
                                                <div className="text-xs text-gray-500">{order.customer_phone}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center space-x-1 text-sm">
                                                    {getOrderTypeIcon(order.order_type)}
                                                    <span>{getOrderTypeLabel(order.order_type)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {order.items.reduce((sum: number, item: any) => sum + item.quantity, 0)} articles
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {order.items.length} article(s) différents
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-bold text-gray-900">
                                                    {order.total_amount.toLocaleString()} f CFA
                                                </span>
                                                {order.delivery_fee > 0 && (
                                                    <span className="text-xs text-gray-500 block">
                                                        + {order.delivery_fee.toLocaleString()} f CFA livraison
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {getStatusBadge(order.status)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDate(order.created_at!)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center space-x-2">
                                                    {order.status === 'pending' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleConfirm(order.id!)}
                                                                disabled={currentProcessing === order.id}
                                                                className="text-green-600 hover:text-green-800 text-sm disabled:opacity-50"
                                                            >
                                                                {currentProcessing === order.id ? '...' : 'Valider'}
                                                            </button>
                                                            <button
                                                                onClick={() => setSelectedOrder(order)}
                                                                className="text-blue-600 hover:text-blue-800 text-sm"
                                                            >
                                                                Détails
                                                            </button>
                                                        </>
                                                    )}
                                                    {order.status === 'confirmed' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleMarkReady(order.id!)}
                                                                disabled={currentProcessing === order.id}
                                                                className="text-purple-600 hover:text-purple-800 text-sm disabled:opacity-50"
                                                            >
                                                                {currentProcessing === order.id ? '...' : 'Prête'}
                                                            </button>
                                                            <button
                                                                onClick={() => setSelectedOrder(order)}
                                                                className="text-blue-600 hover:text-blue-800 text-sm"
                                                            >
                                                                Détails
                                                            </button>
                                                        </>
                                                    )}
                                                    {order.status === 'ready' && (
                                                        <button
                                                            onClick={() => openPaymentModal(order)}
                                                            className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 transition"
                                                        >
                                                            <DollarSign className="w-4 h-4 inline mr-1" />
                                                            Encaisser
                                                        </button>
                                                    )}
                                                    {order.status === 'completed' && (
                                                        <span className="text-xs text-green-600">✅ Payée</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {filteredOrders.length === 0 && (
                            <div className="text-center py-12">
                                <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-600">Aucune commande en ligne</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Modal détails commande */}
            {selectedOrder && !showPaymentModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Détails de la commande</h3>
                                <p className="text-sm text-gray-500">{selectedOrder.order_number}</p>
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Infos client */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-900 mb-2">Client</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center">
                                            <User className="w-4 h-4 text-gray-400 mr-2" />
                                            <span>{selectedOrder.customer_name}</span>
                                        </div>
                                        <div className="flex items-center">
                                            <Phone className="w-4 h-4 text-gray-400 mr-2" />
                                            <span>{selectedOrder.customer_phone}</span>
                                        </div>
                                        {selectedOrder.customer_email && (
                                            <div className="flex items-center">
                                                <span className="text-gray-400 mr-2">✉</span>
                                                <span>{selectedOrder.customer_email}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-900 mb-2">Commande</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center">
                                            {getOrderTypeIcon(selectedOrder.order_type)}
                                            <span className="ml-2">{getOrderTypeLabel(selectedOrder.order_type)}</span>
                                        </div>
                                        {selectedOrder.order_type === 'delivery' && selectedOrder.delivery_address && (
                                            <div className="flex items-start">
                                                <MapPin className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                                                <span>{selectedOrder.delivery_address}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center">
                                            <Clock className="w-4 h-4 text-gray-400 mr-2" />
                                            <span>{formatDate(selectedOrder.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Articles */}
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-3">Articles</h4>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Article</th>
                                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qté</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Prix</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {selectedOrder.items.map((item: any, index: number) => (
                                                <tr key={index}>
                                                    <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                                                    <td className="px-4 py-2 text-center text-sm text-gray-900">{item.quantity}</td>
                                                    <td className="px-4 py-2 text-right text-sm text-gray-900">
                                                        {item.price.toLocaleString()} f CFA
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">
                                                        {item.total.toLocaleString()} f CFA
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50 border-t border-gray-200">
                                            <tr>
                                                <td colSpan={3} className="px-4 py-2 text-right font-semibold text-gray-900">
                                                    Sous-total
                                                </td>
                                                <td className="px-4 py-2 text-right font-semibold text-gray-900">
                                                    {selectedOrder.subtotal.toLocaleString()} f CFA
                                                </td>
                                            </tr>
                                            {selectedOrder.delivery_fee > 0 && (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-2 text-right text-sm text-gray-600">
                                                        Livraison
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-sm text-gray-600">
                                                        {selectedOrder.delivery_fee.toLocaleString()} f CFA
                                                    </td>
                                                </tr>
                                            )}
                                            <tr>
                                                <td colSpan={3} className="px-4 py-2 text-right font-bold text-gray-900">
                                                    Total
                                                </td>
                                                <td className="px-4 py-2 text-right font-bold text-blue-600">
                                                    {selectedOrder.total_amount.toLocaleString()} f CFA
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                                {selectedOrder.status === 'pending' && (
                                    <button
                                        onClick={() => handleConfirm(selectedOrder.id)}
                                        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
                                    >
                                        Valider la commande
                                    </button>
                                )}
                                {selectedOrder.status === 'confirmed' && (
                                    <button
                                        onClick={() => handleMarkReady(selectedOrder.id)}
                                        className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
                                    >
                                        Marquer comme prête
                                    </button>
                                )}
                                {selectedOrder.status === 'ready' && (
                                    <button
                                        onClick={() => openPaymentModal(selectedOrder)}
                                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                                    >
                                        Encaisser
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedOrder(null)}
                                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de paiement */}
            {showPaymentModal && selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <h3 className="text-xl font-bold text-gray-900">Paiement</h3>
                            <button
                                onClick={() => {
                                    setShowPaymentModal(false);
                                    setSelectedOrder(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Commande</span>
                                    <span className="font-medium">{selectedOrder.order_number}</span>
                                </div>
                                <div className="flex justify-between text-sm mt-1">
                                    <span className="text-gray-600">Client</span>
                                    <span className="font-medium">{selectedOrder.customer_name}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold mt-3 pt-3 border-t border-gray-200">
                                    <span>Montant total</span>
                                    <span className="text-blue-600">{selectedOrder.total_amount.toLocaleString()} f CFA</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Mode de paiement
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    <button
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`p-3 border-2 rounded-lg text-center transition ${paymentMethod === 'cash'
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <DollarSign className="w-6 h-6 mx-auto text-gray-700" />
                                        <span className="text-xs font-medium">Espèces</span>
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('mobile_money')}
                                        className={`p-3 border-2 rounded-lg text-center transition ${paymentMethod === 'mobile_money'
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Smartphone className="w-6 h-6 mx-auto text-gray-700" />
                                        <span className="text-xs font-medium">Mobile Money</span>
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('card')}
                                        className={`p-3 border-2 rounded-lg text-center transition ${paymentMethod === 'card'
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <CreditCard className="w-6 h-6 mx-auto text-gray-700" />
                                        <span className="text-xs font-medium">Carte</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    onClick={() => {
                                        setShowPaymentModal(false);
                                        setSelectedOrder(null);
                                    }}
                                    className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={() => handleComplete(selectedOrder.id)}
                                    disabled={currentProcessing === selectedOrder.id}
                                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition"
                                >
                                    {currentProcessing === selectedOrder.id ? '...' : 'Confirmer le paiement'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// EXPORT PAR DÉFAUT - C'EST CE QUI MANQUAIT !
export default CashierOnlineOrders;
