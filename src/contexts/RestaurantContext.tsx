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

// Valeurs par défaut
const defaultSettings: RestaurantSettings = {
  name: 'Terra Cotta',
  address: '',
  phone: '',
  email: '',
  currency: 'f CFA',
  tax_rate: 10,
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
      
      // Utilisez .limit(1) au lieu de .single() pour éviter l'erreur 406
      const { data, error } = await supabase
        .from('restaurant_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('❌ Erreur lors du chargement des paramètres:', error);
        setSettings(defaultSettings);
      } else if (data && data.length > 0) {
        console.log('✅ Paramètres chargés avec succès:', data[0]);
        setSettings(data[0]);
      } else {
        console.log('📝 Aucun paramètre trouvé, création des paramètres par défaut...');
        await createDefaultSettings();
      }
    } catch (error) {
      console.error('💥 Erreur inattendue:', error);
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
        console.error('❌ Erreur lors de la création des paramètres par défaut:', error);
        setSettings(defaultSettings);
      } else if (data) {
        console.log('✅ Paramètres par défaut créés:', data);
        setSettings(data);
      }
    } catch (error) {
      console.error('💥 Erreur lors de la création des paramètres:', error);
      setSettings(defaultSettings);
    }
  };

  const updateSettings = async (newSettings: Partial<RestaurantSettings>) => {
    try {
      // Si nous n'avons pas d'ID, c'est qu'aucun enregistrement n'existe
      if (!settings.id) {
        const { data, error } = await supabase
          .from('restaurant_settings')
          .insert([{ ...defaultSettings, ...newSettings }])
          .select()
          .single();

        if (error) throw error;
        if (data) setSettings(data);
      } else {
        // Mettre à jour l'enregistrement existant
        const { data, error } = await supabase
          .from('restaurant_settings')
          .update(newSettings)
          .eq('id', settings.id)
          .select()
          .single();

        if (error) throw error;
        if (data) setSettings(data);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Chargement des paramètres...</div>
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
