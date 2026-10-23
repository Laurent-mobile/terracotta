//src/components/public/MenuView.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Home, Phone, CreditCard, Building, AlertCircle, Download } from 'lucide-react';

interface RestaurantInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  menu_image_url: string;  // Nouveau champ pour l'image du menu
}

export default function MenuView() {
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    loadRestaurantAndMenu();
  }, []);

  const loadRestaurantAndMenu = async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger les informations du restaurant (y compris l'image du menu)
      const { data: settingsData, error: settingsError } = await supabase
        .from('restaurant_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (settingsError) {
        console.warn('Erreur chargement settings:', settingsError);
      }

      const settings = settingsData && settingsData.length > 0 ? settingsData[0] : null;

      setRestaurantInfo(settings ? {
        name: settings.name || 'Notre Restaurant',
        address: settings.address || '',
        phone: settings.phone || '',
        email: settings.email || '',
        logo_url: settings.logo_url || '',
        menu_image_url: settings.menu_image_url || ''  // Récupérer l'URL de l'image du menu
      } : {
        name: 'Notre Restaurant',
        address: '',
        phone: '',
        email: '',
        logo_url: '',
        menu_image_url: ''
      });

    } catch (error: any) {
      console.error('Erreur chargement:', error);
      setError('Impossible de charger le menu. Veuillez réessayer plus tard.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement du menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Erreur</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* En-tête avec informations restaurant */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {restaurantInfo?.logo_url ? (
                <img 
                  src={restaurantInfo.logo_url} 
                  alt={restaurantInfo.name} 
                  className="w-10 h-10 rounded-lg object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                  <Building className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-slate-900">{restaurantInfo?.name || 'Notre Restaurant'}</h1>
                <p className="text-xs text-slate-500">Menu numérique</p>
              </div>
            </div>
            {restaurantInfo?.menu_image_url && !imageError && (
              <a 
                href={restaurantInfo.menu_image_url} 
                download="menu-restaurant.jpg"
                className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Télécharger</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Image du menu */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {restaurantInfo?.menu_image_url && !imageError ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <img 
              src={restaurantInfo.menu_image_url} 
              alt="Menu du restaurant" 
              className="w-full h-auto"
              onError={() => setImageError(true)}
              loading="lazy"
            />
            <div className="p-4 bg-slate-50 border-t border-slate-200 text-center">
              <p className="text-sm text-slate-500">
                📱 Scannez ce code pour accéder au menu sur votre téléphone
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Menu non disponible</h3>
            <p className="text-slate-500">
              L'administrateur n'a pas encore téléchargé le menu.
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Veuillez réessayer plus tard.
            </p>
          </div>
        )}
      </main>

      {/* Pied de page avec informations de contact */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Home className="w-4 h-4 text-slate-600" />
                </div>
                <h3 className="font-semibold text-slate-900">Adresse</h3>
              </div>
              <p className="text-sm text-slate-600">{restaurantInfo?.address || 'Adresse non renseignée'}</p>
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-slate-600" />
                </div>
                <h3 className="font-semibold text-slate-900">Contact</h3>
              </div>
              <p className="text-sm text-slate-600">{restaurantInfo?.phone || 'Téléphone non renseigné'}</p>
              <p className="text-sm text-slate-600">{restaurantInfo?.email || 'Email non renseigné'}</p>
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-slate-600" />
                </div>
                <h3 className="font-semibold text-slate-900">Paiements acceptés</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                  💵 Espèces
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                  📱 Mobile Money
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
                  💳 Carte
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
            <p>Menu numérique - Mise à jour régulière</p>
            <p className="mt-1">© {new Date().getFullYear()} - Tous droits réservés</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
