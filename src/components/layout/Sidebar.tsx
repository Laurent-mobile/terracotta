// src/components/layout/Sidebar.tsx
import {
  LayoutDashboard,
  Package,
  Users,
  DollarSign,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  LogOut,
  ClipboardList,
  ChefHat,
  ListOrdered,
  Tag,
  Settings,
  FileText,
  Building,
  Trash2,
  ShoppingBag
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { usePermissions } from '../../hooks/usePermissions';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { signOut } = useAuth();
  const { settings } = useRestaurant();
  const { canAccessView, loading: permissionsLoading } = usePermissions();

  // Valeurs par défaut sécurisées
  const safeSettings = {
    name: settings?.name || 'Mon Restaurant',
    logo_url: settings?.logo_url || null
  };

  // Liste complète des éléments de menu
  const allMenuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'orders', label: 'Commandes', icon: ClipboardList },
    { id: 'cashier', label: 'Caisse (File d\'attente)', icon: ListOrdered, highlight: true },
    { id: 'online-orders', label: 'Commandes en ligne', icon: ShoppingBag, highlight: true },
    { id: 'menus', label: 'Menus cuisine/BAR', icon: ChefHat },
    { id: 'inventory', label: 'Stock / Inventaire', icon: Package },
    { id: 'inventory-categories', label: 'Catégories Inventaire', icon: Tag },
    { id: 'supplier-orders', label: 'Commandes Frs', icon: ShoppingCart },
    { id: 'suppliers', label: 'Fournisseurs', icon: Users },
    { id: 'expenses', label: 'Dépenses', icon: DollarSign },
    { id: 'reports', label: 'Rapports Détaillés', icon: TrendingUp },
    { id: 'cash-register-history', label: 'Historique Caisses', icon: FileText },
    { id: 'cancelled-orders', label: 'Cdes Annulées', icon: Trash2, badge: 'new' },
    { id: 'employees', label: 'Gestion Employés', icon: Users },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  // Filtrer les éléments de menu selon les permissions
  const filteredMenuItems = permissionsLoading
    ? []
    : allMenuItems.filter(item => canAccessView(item.id));

  if (permissionsLoading) {
    return (
      <div className="w-64 bg-slate-900 text-white h-screen flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
              <Building className="w-6 h-6 text-slate-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{safeSettings.name}</h1>
              <p className="text-sm text-slate-400 mt-1">Gestion Restaurant</p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-slate-400 text-sm">Chargement des permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          {safeSettings.logo_url ? (
            <img
              src={safeSettings.logo_url}
              alt="Logo"
              className="w-10 h-10 rounded-lg object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
              <Building className="w-6 h-6 text-slate-300" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{safeSettings.name}</h1>
            <p className="text-sm text-slate-400 mt-1">Gestion Restaurant</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredMenuItems.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <Settings className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-400 text-sm">Aucun accès autorisé</p>
            <p className="text-slate-500 text-xs mt-1">Contactez votre administrateur</p>
          </div>
        ) : (
          filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  } ${item.highlight ? 'bg-emerald-900 text-emerald-100 hover:bg-emerald-800' : ''}`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {item.badge && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })
        )}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={signOut}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
