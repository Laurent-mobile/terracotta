import React, { useState, useEffect } from 'react';
import { useClientCart } from '../../contexts/ClientCartContext';
import { useClientOrders } from '../../hooks/useClientOrders';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, User, Phone, MapPin, Truck, Package, Loader2, Navigation, ShoppingBag, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

interface ClientCheckoutProps {
  onSuccess: (orderNumber: string) => void;
  onBack: () => void;
}

const MOBILE_PROVIDERS = [
  { id: 'orange', name: 'Orange Money', color: 'bg-orange-500', icon: '🟠' },
  { id: 'moov', name: 'Moov Money', color: 'bg-blue-600', icon: '🔵' },
  { id: 'wave', name: 'Wave', color: 'bg-cyan-400', icon: '🌊' },
  { id: 'telecel', name: 'Telecel', color: 'bg-red-600', icon: '🔴' },
];

export default function ClientCheckout({ onSuccess, onBack }: ClientCheckoutProps) {
  const { user } = useAuth();
  const { items, getTotal, clearCart } = useClientCart();
  const { createOrder, loading } = useClientOrders();

  const savedInfo = JSON.parse(localStorage.getItem('client_checkout_info') || '{}');

  const [orderType, setOrderType] = useState<'delivery' | 'takeaway'>('takeaway');
  const [customerInfo, setCustomerInfo] = useState({
    name: user?.user_metadata?.full_name || savedInfo.name || '',
    phone: user?.user_metadata?.phone || savedInfo.phone || '',
    address: savedInfo.address || '',
    notes: savedInfo.notes || '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [selectedMobileProvider, setSelectedMobileProvider] = useState('orange');

  const total = getTotal();
  const deliveryFee = orderType === 'delivery' ? 1500 : 0;

  useEffect(() => {
    localStorage.setItem('client_checkout_info', JSON.stringify(customerInfo));
  }, [customerInfo]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError('La géolocalisation n\'est pas supportée par votre navigateur.');
      return;
    }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomerInfo((prev) => ({
          ...prev,
          address: `Position GPS: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
        }));
        setIsGettingLocation(false);
        toast.success('Position récupérée avec succès !');
      },
      () => {
        setError('Impossible de récupérer votre position. Veuillez l\'entrer manuellement.');
        setIsGettingLocation(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerInfo.name.trim()) {
      setError('Veuillez entrer votre nom');
      return;
    }
    if (!customerInfo.phone.trim() || customerInfo.phone.length < 8) {
      setError('Veuillez entrer un numéro de téléphone valide');
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
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        })),
        subtotal: total,
        delivery_fee: deliveryFee,
        total_amount: total + deliveryFee,
        order_type: orderType,
        delivery_address: orderType === 'delivery' ? customerInfo.address : undefined,
        notes: customerInfo.notes || undefined,
        payment_method: orderType === 'delivery' ? (selectedMobileProvider !== 'orange' ? 'mobile_money' : 'cash') : 'cash', // Simplifié pour l'exemple
      };

      const order = await createOrder(orderData);
      clearCart();
      toast.success('Commande passée avec succès ! 🎉');
      onSuccess(order.order_number);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erreur lors de la création de la commande');
      toast.error('Erreur lors de la commande');
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 p-4 pb-32">
      <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-900 mb-6 font-medium active:scale-95 transition">
        <ArrowLeft className="w-5 h-5 mr-2" />
        Retour au panier
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Finaliser la commande</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type de commande */}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setOrderType('takeaway')} className={`p-4 border-2 rounded-2xl text-center transition-all active:scale-95 ${orderType === 'takeaway' ? 'border-terracotta-600 bg-terracotta-50 text-terracotta-700' : 'border-gray-200 bg-white'}`}>
            <Package className="w-6 h-6 mx-auto mb-2 text-gray-600" />
            <span className="font-bold block">À emporter</span>
          </button>
          <button type="button" onClick={() => setOrderType('delivery')} className={`p-4 border-2 rounded-2xl text-center transition-all active:scale-95 ${orderType === 'delivery' ? 'border-terracotta-600 bg-terracotta-50 text-terracotta-700' : 'border-gray-200 bg-white'}`}>
            <Truck className="w-6 h-6 mx-auto mb-2 text-gray-600" />
            <span className="font-bold block">Livraison</span>
            <span className="block text-xs text-gray-500 mt-1">+1500 f CFA</span>
          </button>
        </div>

        {/* Informations client */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 shadow-soft">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-terracotta-600" /> Informations client
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet *</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input type="text" value={customerInfo.name} onChange={(e) => setCustomerInfo((prev) => ({ ...prev, name: e.target.value }))} className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:border-transparent outline-none transition" placeholder="Votre nom" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone *</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input type="tel" value={customerInfo.phone} onChange={(e) => setCustomerInfo((prev) => ({ ...prev, phone: e.target.value }))} className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:border-transparent outline-none transition" placeholder="Ex: 07 07 07 07" required />
            </div>
          </div>

          {orderType === 'delivery' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse de livraison *</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3.5 text-gray-400 w-5 h-5" />
                <textarea value={customerInfo.address} onChange={(e) => setCustomerInfo((prev) => ({ ...prev, address: e.target.value }))} rows={3} className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:border-transparent outline-none transition resize-none" placeholder="Quartier, rue, repère..." required />
                <button type="button" onClick={handleGetLocation} disabled={isGettingLocation} className="absolute right-3 top-3 p-2 text-terracotta-600 hover:bg-terracotta-50 rounded-lg transition disabled:opacity-50" title="Utiliser ma position actuelle">
                  {isGettingLocation ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Instructions spéciales</label>
            <textarea value={customerInfo.notes} onChange={(e) => setCustomerInfo((prev) => ({ ...prev, notes: e.target.value }))} rows={2} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:border-transparent outline-none transition resize-none" placeholder="Allergies, code porte, etc." />
          </div>
        </div>

        {/* Paiement Mobile Money (si livraison) */}
        {orderType === 'delivery' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-soft">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-terracotta-600" /> Paiement Mobile Money
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {MOBILE_PROVIDERS.map(provider => (
                <button key={provider.id} type="button" onClick={() => setSelectedMobileProvider(provider.id)} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-95 ${selectedMobileProvider === provider.id ? 'border-terracotta-600 bg-terracotta-50' : 'border-gray-100 bg-gray-50'}`}>
                  <span className="text-2xl">{provider.icon}</span>
                  <span className="font-semibold text-sm text-gray-800">{provider.name}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <span className="text-lg">💡</span> Vous recevrez une demande de validation sur le numéro indiqué plus haut.
            </p>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Résumé Sticky en bas */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-600">Total à payer</span>
              <span className="text-2xl font-bold text-terracotta-700">{(total + deliveryFee).toLocaleString()} <span className="text-sm">f CFA</span></span>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-terracotta-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-terracotta-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-terracotta flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmer et Payer'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
