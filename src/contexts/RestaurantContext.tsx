// src/contexts/RestaurantContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface RestaurantSettings {
  id?: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  tax_rate: number;
  logo_url: string;
  theme_color: string;
  language: string;
}

interface RestaurantContextType {
  settings: RestaurantSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<RestaurantSettings>) => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

const defaultSettings: RestaurantSettings = {
  name: 'LA TERRA COTTA OUAGA',
  address: 'Ouagadougou, Burkina Faso',
  phone: '04 04 34 35',
  email: 'contact@terracotta.bf',
  currency: 'f CFA',
  tax_rate: 0,
  logo_url: '',
  theme_color: 'blue',
  language: 'fr'
};

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<RestaurantSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    try {
      console.log('🔧 Chargement des paramètres du restaurant...');
      
      const { data, error } = await supabase
        .from('restaurant_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        // 🔥 CORRECTION : Extraire le vrai message d'erreur de manière fiable
        const errorMsg = error.message || JSON.stringify(error) || 'Erreur inconnue';
        console.error('❌ Erreur Supabase chargement paramètres:', errorMsg);
        console.error('Détails complets:', error);
        setSettings(defaultSettings); // Fallback pour ne pas bloquer l'app
      } else if (data && data.length > 0) {
        console.log('✅ Paramètres chargés avec succès:', data[0]);
        setSettings(data[0]);
      } else {
        console.log('📝 Aucun paramètre trouvé, création des paramètres par défaut...');
        await createDefaultSettings();
      }
    } catch (error: any) {
      const errorMsg = error?.message || JSON.stringify(error) || 'Erreur inattendue';
      console.error('💥 Erreur inattendue chargement paramètres:', errorMsg);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    try {
      console.log('🔄 Création des paramètres par défaut...');
      
      const { data, error } = await supabase
        .from('restaurant_settings')
        .insert([defaultSettings])
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur création paramètres par défaut:', error.message || JSON.stringify(error));
        setSettings(defaultSettings);
      } else if (data) {
        console.log('✅ Paramètres par défaut créés:', data);
        setSettings(data);
      }
    } catch (error: any) {
      console.error('💥 Erreur inattendue création paramètres:', error?.message || error);
      setSettings(defaultSettings);
    }
  };

  const updateSettings = async (newSettings: Partial<RestaurantSettings>) => {
    try {
      if (!settings.id) {
        const { data, error } = await supabase
          .from('restaurant_settings')
          .insert([{ ...defaultSettings, ...newSettings }])
          .select()
          .single();
        if (error) throw error;
        if (data) setSettings(data);
      } else {
        const { data, error } = await supabase
          .from('restaurant_settings')
          .update(newSettings)
          .eq('id', settings.id)
          .select()
          .single();
        if (error) throw error;
        if (data) setSettings(data);
      }
    } catch (error: any) {
      console.error('Error updating settings:', error.message || error);
      throw error;
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-lg text-slate-600">Chargement des paramètres...</div>
      </div>
    );
  }

  return (
    <RestaurantContext.Provider value={{ 
      settings, 
      loading, 
      refreshSettings: loadSettings,
      updateSettings
    }}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const context = useContext(RestaurantContext);
  if (context === undefined) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
}
