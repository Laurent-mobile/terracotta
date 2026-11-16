import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RestaurantProvider } from './contexts/RestaurantContext';
import LoginForm from './components/auth/LoginForm';
import DashboardView from './components/dashboard/DashboardView';
import InventoryView from './components/inventory/InventoryView';
import SuppliersView from './components/suppliers/SuppliersView';
import ExpensesView from './components/expenses/ExpensesView';
import SalesView from './components/sales/SalesView';
import Sidebar from './components/layout/Sidebar';
import MultiOrderManager from './components/pos/MultiOrderManager';
import './App.css';
import CashierQueue from './components/cash/CashierQueue';
import SupplierOrdersView from './components/suppliers/SupplierOrdersView';
import InventoryCategoriesView from './components/inventory/InventoryCategoriesView';
import DetailedReportsView from './components/reports/DetailedReportsView';
import SettingsView from './components/settings/SettingsView';
import CashRegisterHistory from './components/cash/CashRegisterHistory';
import DailyMenusView from './components/menus/DailyMenusView';
import EmployeesView from './components/employees/EmployeesView';
import CancelledOrdersHistory from './components/pos/CancelledOrdersHistory';
import ProtectedComponent from './components/auth/ProtectedComponent';
import { usePermissions } from './hooks/usePermissions';
import MenuView from './components/public/MenuView';
import CashierOnlineOrders from './components/cash/CashierOnlineOrders';
import ClientDashboard from './pages/ClientDashboard';

import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

const isMobile = Capacitor.isNativePlatform();

function MobileNavigation({
  currentView,
  onViewChange
}: {
  currentView: string;
  onViewChange: (view: string) => void;
}) {
  const { signOut } = useAuth();

  const navItems = [
    { id: 'client-menu', label: 'Menu', icon: '🍽️' },
    { id: 'client-cart', label: 'Panier', icon: '🛒' },
    { id: 'client-history', label: 'Historique', icon: '📋' }
  ];

  const handleLogout = async () => {
    if (window.confirm('Voulez-vous vraiment vous déconnecter ?')) {
      await signOut();
    }
  };

  return (
    <>
      <header className="bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-terracotta-700 flex items-center gap-2">
            <span>🍽️</span> Terra Cotta
          </h1>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-red-50 rounded-full transition text-red-600 active:scale-95"
            title="Déconnexion"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
        <div className="bg-white/90 backdrop-blur-md border border-gray-200/50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-3xl">
          <div className="flex justify-around items-center h-16 px-2 max-w-md mx-auto">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`relative flex flex-col items-center justify-center flex-1 py-1 transition-all duration-300 active:scale-95 ${
                    isActive ? 'text-terracotta-700 -translate-y-1' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {isActive && (
                    <span className="absolute -top-2 w-8 h-1 bg-terracotta-700 rounded-full" />
                  )}
                  <span className={`text-2xl transition-transform ${isActive ? 'scale-110' : ''}`}>
                    {item.icon}
                  </span>
                  <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-terracotta-700' : ''}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const { userRole, loading: permissionsLoading } = usePermissions();
  const [currentView, setCurrentView] = useState<string>('');

  const isPublicMenuRoute = window.location.pathname === '/menu';

  if (isPublicMenuRoute) {
    return <MenuView />;
  }

  useEffect(() => {
    const initMobile = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await SplashScreen.hide();
          await StatusBar.setStyle({ style: 'dark' });
          await StatusBar.setBackgroundColor({ color: '#ffffff' });
          console.log('📱 Application mobile initialisée avec succès');
        } catch (error) {
          console.error('Erreur initialisation mobile:', error);
        }
      }
    };
    initMobile();
  }, []);

  useEffect(() => {
    if (!permissionsLoading && !currentView) {
      if (isMobile) {
        setCurrentView('client-menu');
      } else if (userRole === 'cashier') {
        setCurrentView('orders');
      } else {
        setCurrentView('dashboard');
      }
    }
  }, [userRole, permissionsLoading, currentView]);

  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-terracotta-700 mx-auto mb-4"></div>
          <div className="text-lg font-semibold text-gray-700">Chargement de l'application...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'client-menu':
      case 'client-cart':
      case 'client-checkout':
      case 'client-tracking':
      case 'client-history':
        return <ClientDashboard currentView={currentView} onViewChange={setCurrentView} />;
      case 'dashboard':
        return <ProtectedComponent requiredView="dashboard"><DashboardView /></ProtectedComponent>;
      case 'orders':
        return <ProtectedComponent requiredView="orders"><MultiOrderManager /></ProtectedComponent>;
      case 'cashier':
        return <ProtectedComponent requiredView="cashier"><CashierQueue /></ProtectedComponent>;
      case 'online-orders':
        return <ProtectedComponent requiredView="online-orders"><CashierOnlineOrders /></ProtectedComponent>;
      case 'menus':
        return <ProtectedComponent requiredView="menus"><DailyMenusView /></ProtectedComponent>;
      case 'inventory':
        return <ProtectedComponent requiredView="inventory"><InventoryView /></ProtectedComponent>;
      case 'inventory-categories':
        return <ProtectedComponent requiredView="inventory-categories"><InventoryCategoriesView /></ProtectedComponent>;
      case 'suppliers':
        return <ProtectedComponent requiredView="suppliers"><SuppliersView /></ProtectedComponent>;
      case 'supplier-orders':
        return <ProtectedComponent requiredView="supplier-orders"><SupplierOrdersView /></ProtectedComponent>;
      case 'expenses':
        return <ProtectedComponent requiredView="expenses"><ExpensesView /></ProtectedComponent>;
      case 'sales':
        return <ProtectedComponent requiredView="sales"><SalesView /></ProtectedComponent>;
      case 'reports':
        return <ProtectedComponent requiredView="reports"><DetailedReportsView /></ProtectedComponent>;
      case 'employees':
        return <ProtectedComponent requiredView="employees"><EmployeesView /></ProtectedComponent>;
      case 'settings':
        return <ProtectedComponent requiredView="settings"><SettingsView /></ProtectedComponent>;
      case 'cash-register-history':
        return <ProtectedComponent requiredView="cash-register-history"><CashRegisterHistory /></ProtectedComponent>;
      case 'cancelled-orders':
        return <ProtectedComponent requiredView="cancelled-orders"><CancelledOrdersHistory /></ProtectedComponent>;
      default:
        if (userRole === 'cashier') {
          return <ProtectedComponent requiredView="orders"><MultiOrderManager /></ProtectedComponent>;
        }
        return <ProtectedComponent requiredView="dashboard"><DashboardView /></ProtectedComponent>;
    }
  };

  if (isMobile) {
    return (
      <div className="min-h-screen bg-cream-50">
        <MobileNavigation
          currentView={currentView}
          onViewChange={setCurrentView}
        />
        <main className="pb-20">
          {renderView()}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 overflow-y-auto">
        {renderView()}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <RestaurantProvider>
        <AppContent />
      </RestaurantProvider>
    </AuthProvider>
  );
}

export default App;
