// src/components/client/ClientOrderTracking.tsx
import React, { useState, useEffect } from 'react';
import { useClientOrders } from '../../hooks/useClientOrders';
import { useAuth } from '../../contexts/AuthContext';
import {
  CheckCircle,
  Clock,
  Package,
  Truck,
  Home,
  XCircle,
  ArrowLeft,
  Phone,
  ChefHat,
  Timer,
  MapPin,
  AlertCircle,
  RefreshCw,
  ShoppingBag
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ClientOrderTrackingProps {
  orderNumber: string;
  onBack: () => void;
}

// Configuration des étapes de suivi
const ORDER_STEPS = [
  {
    status: 'pending',
    label: 'Commande reçue',
    description: 'Votre commande a été enregistrée',
    icon: Clock,
    estimatedTime: 2, // minutes
  },
  {
    status: 'confirmed',
    label: 'Confirmée',
    description: 'Le restaurant a accepté votre commande',
    icon: CheckCircle,
    estimatedTime: 5,
  },
  {
    status: 'preparing',
    label: 'En préparation',
    description: 'Notre chef prépare vos plats',
    icon: ChefHat,
    estimatedTime: 15,
  },
  {
    status: 'ready',
    label: 'Prête',
    description: 'Votre commande est prête à être récupérée',
    icon: Package,
    estimatedTime: 0,
  },
  {
    status: 'completed',
    label: 'Terminée',
    description: 'Merci de votre visite !',
    icon: Home,
    estimatedTime: 0,
  },
];

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; textColor: string }> = {
  pending: { color: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  confirmed: { color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  preparing: { color: 'bg-purple-500', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
  ready: { color: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700' },
  completed: { color: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
  cancelled: { color: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700' },
};

export default function ClientOrderTracking({ orderNumber, onBack }: ClientOrderTrackingProps) {
  const { user } = useAuth();
  const { orders, trackOrder } = useClientOrders();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedRemaining, setEstimatedRemaining] = useState(0);

  // Trouver la commande
  useEffect(() => {
    const found = orders.find((o) => o.order_number === orderNumber);
    if (found) {
      setOrder(found);
      setLoading(false);
    } else {
      const interval = setInterval(() => {
        const updated = orders.find((o) => o.order_number === orderNumber);
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

  // Calcul du temps écoulé et estimé
  useEffect(() => {
    if (!order?.created_at) return;

    const updateTimer = () => {
      const createdAt = new Date(order.created_at).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - createdAt) / 1000 / 60); // en minutes
      setElapsedTime(elapsed);

      // Calcul du temps restant estimé
      const currentStepIndex = ORDER_STEPS.findIndex((s) => s.status === order.status);
      if (currentStepIndex >= 0 && currentStepIndex < ORDER_STEPS.length - 1) {
        const remainingSteps = ORDER_STEPS.slice(currentStepIndex + 1);
        const totalEstimated = remainingSteps.reduce((sum, step) => sum + step.estimatedTime, 0);
        setEstimatedRemaining(Math.max(0, totalEstimated - elapsed));
      } else {
        setEstimatedRemaining(0);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 30000); // Met à jour toutes les 30s
    return () => clearInterval(interval);
  }, [order?.created_at, order?.status]);

  const handleCallRestaurant = () => {
    window.location.href = 'tel:+22604043435';
    toast.success('Appel en cours...', { icon: '📞' });
  };

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    const index = ORDER_STEPS.findIndex((s) => s.status === order.status);
    return index >= 0 ? index : 0;
  };

  const formatTime = (minutes: number) => {
    if (minutes < 1) return 'Moins d\'une minute';
    if (minutes === 1) return '1 minute';
    return `${minutes} minutes`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
        <div className="text-center animate-fade-in">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-terracotta-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-terracotta-600 rounded-full border-t-transparent animate-spin"></div>
            <Package className="absolute inset-0 m-auto w-8 h-8 text-terracotta-600" />
          </div>
          <p className="text-lg font-semibold text-gray-900">Recherche de votre commande...</p>
          <p className="text-sm text-gray-500 mt-2">{orderNumber}</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-3xl shadow-soft border border-gray-100 p-8 max-w-md animate-fade-in">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Commande introuvable</h2>
          <p className="text-gray-600 mb-6">
            Nous ne trouvons pas de commande avec le numéro <strong>{orderNumber}</strong>
          </p>
          <button
            onClick={onBack}
            className="bg-terracotta-600 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-terracotta-700 active:scale-95 transition-all shadow-terracotta"
          >
            Retour à l'historique
          </button>
        </div>
      </div>
    );
  }

  const currentStepIndex = getCurrentStepIndex();
  const currentStep = ORDER_STEPS[currentStepIndex];
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="min-h-screen bg-cream-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="p-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-terracotta-700 font-medium active:scale-95 transition"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour
          </button>
          <h1 className="text-lg font-bold text-gray-900">Suivi de commande</h1>
          <button
            onClick={() => {
              toast.success('Actualisation...', { icon: '🔄' });
              window.location.reload();
            }}
            className="p-2 text-gray-600 hover:text-terracotta-700 hover:bg-terracotta-50 rounded-full active:scale-95 transition"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Carte de statut principal */}
        <div className={`rounded-3xl p-6 shadow-soft border animate-fade-in ${
          isCancelled ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Numéro de commande</p>
              <p className="text-xl font-bold text-gray-900 font-mono">{order.order_number}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${statusConfig.bgColor} ${statusConfig.textColor}`}>
              {currentStep.label}
            </span>
          </div>

          {!isCancelled && (
            <>
              {/* Temps estimé */}
              <div className="bg-gradient-to-r from-terracotta-50 to-cream-100 rounded-2xl p-4 border border-terracotta-100 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-terracotta-600 rounded-xl flex items-center justify-center shadow-terracotta">
                    <Timer className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Temps estimé restant</p>
                    <p className="text-2xl font-bold text-terracotta-700">
                      {estimatedRemaining > 0 ? formatTime(estimatedRemaining) : 'Presque prêt !'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Temps écoulé */}
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Commande passée il y a {formatTime(elapsedTime)}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </>
          )}

          {isCancelled && (
            <div className="bg-red-100 rounded-2xl p-4 border border-red-200">
              <div className="flex items-center gap-3">
                <XCircle className="w-10 h-10 text-red-600" />
                <div>
                  <p className="font-bold text-red-900">Commande annulée</p>
                  <p className="text-sm text-red-700">Cette commande a été annulée</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Timeline des étapes */}
        {!isCancelled && (
          <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-6 animate-fade-in">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Package className="w-5 h-5 text-terracotta-600" />
              Progression de la commande
            </h3>

            <div className="space-y-0">
              {ORDER_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isFuture = index > currentStepIndex;

                return (
                  <div key={step.status} className="relative flex gap-4">
                    {/* Ligne verticale */}
                    {index < ORDER_STEPS.length - 1 && (
                      <div className="absolute left-5 top-12 w-0.5 h-full bg-gray-200">
                        <div
                          className={`absolute inset-0 transition-all duration-1000 ${
                            isCompleted ? 'bg-terracotta-600' : 'bg-transparent'
                          }`}
                        />
                      </div>
                    )}

                    {/* Icône */}
                    <div className="relative z-10 flex-shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                          isCompleted
                            ? 'bg-terracotta-600 text-white shadow-terracotta'
                            : isCurrent
                            ? 'bg-white border-2 border-terracotta-600 text-terracotta-600 shadow-md animate-pulse-soft'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 pb-8">
                      <div
                        className={`transition-all duration-300 ${
                          isCurrent ? 'animate-fade-in' : ''
                        }`}
                      >
                        <p
                          className={`font-semibold ${
                            isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'
                          }`}
                        >
                          {step.label}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>

                        {isCurrent && step.estimatedTime > 0 && (
                          <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-terracotta-50 rounded-full">
                            <Clock className="w-3 h-3 text-terracotta-600" />
                            <span className="text-xs font-medium text-terracotta-700">
                              ~{step.estimatedTime} min
                            </span>
                          </div>
                        )}

                        {isCompleted && (
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Terminé
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Détails de la commande */}
        <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-6 animate-fade-in">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-terracotta-600" />
            Détails de la commande
          </h3>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Type</p>
                <p className="font-semibold text-gray-900 capitalize flex items-center gap-1">
                  {order.order_type === 'delivery' ? (
                    <>
                      <Truck className="w-4 h-4 text-terracotta-600" />
                      Livraison
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4 text-terracotta-600" />
                      À emporter
                    </>
                  )}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Date</p>
                <p className="font-semibold text-gray-900">
                  {new Date(order.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Client</p>
                <p className="font-semibold text-gray-900 truncate">{order.customer_name}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Téléphone</p>
                <p className="font-semibold text-gray-900">{order.customer_phone}</p>
              </div>
            </div>

            {order.delivery_address && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Adresse de livraison
                </p>
                <p className="font-medium text-gray-900">{order.delivery_address}</p>
              </div>
            )}
          </div>

          {/* Articles */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">Articles commandés</h4>
            <div className="space-y-2">
              {order.items?.map((item: any, index: number) => (
                <div
                  key={index}
                  className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.quantity} × {item.price?.toLocaleString()} f CFA
                    </p>
                  </div>
                  <p className="font-bold text-terracotta-700 text-sm">
                    {item.total?.toLocaleString()} f CFA
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t-2 border-terracotta-200">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900">Total</span>
                <span className="text-xl font-bold text-terracotta-700">
                  {order.total_amount?.toLocaleString()} f CFA
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bouton d'appel */}
        {!isCancelled && (
          <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-4 animate-fade-in">
            <button
              onClick={handleCallRestaurant}
              className="w-full bg-gradient-to-r from-terracotta-600 to-terracotta-700 text-white py-4 rounded-2xl font-bold text-lg hover:from-terracotta-700 hover:to-terracotta-800 active:scale-[0.98] transition-all shadow-terracotta flex items-center justify-center gap-3"
            >
              <Phone className="w-6 h-6" />
              Appeler le restaurant
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
              Besoin d'aide ? Contactez-nous directement
            </p>
          </div>
        )}

        {/* Notes spéciales */}
        {order.notes && (
          <div className="bg-amber-50 rounded-3xl shadow-soft border border-amber-200 p-5 animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-900 mb-1">Instructions spéciales</h4>
                <p className="text-sm text-amber-800">{order.notes}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
