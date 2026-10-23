// src/App.tsx
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RestaurantProvider } from './contexts/RestaurantContext';
import LoginForm from './components/auth/LoginForm';
import DashboardView from './components/dashboard/DashboardView';
import InventoryView from './components/inventory/InventoryView';
import SuppliersView from './components/suppliers/SuppliersView';
import ExpensesView from './components/expenses/ExpensesView';
import SalesView from './components/sales/SalesView';
import ReportsView from './components/reports/ReportsView';
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

// Dépendances Capacitor pour le mobile
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

// Détection de la plateforme
const isMobile = Capacitor.isNativePlatform();

// Composant de navigation mobile - UNIQUEMENT POUR CLIENTS
function MobileNavigation({
    currentView,
    onViewChange
}: {
    currentView: string;
    onViewChange: (view: string) => void;
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { signOut } = useAuth();

    // Navigation client uniquement
    const navItems = [
        { id: 'client-menu', label: 'Menu', icon: '🍽️' },
        { id: 'client-cart', label: 'Panier', icon: '🛒' },
        { id: 'client-history', label: 'Historique', icon: '📋' }
    ];

    const handleLogout = async () => {
        if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
            await signOut();
        }
    };

    return (
        <>
            {/* Barre de navigation supérieure */}
            <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
                <div className="px-4 py-3 flex items-center justify-between">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <h1 className="text-lg font-bold text-gray-900">🍽️ Terra Cotta</h1>
                    <button
                        onClick={handleLogout}
                        className="p-2 hover:bg-red-50 rounded-lg transition text-red-600"
                        title="Déconnexion"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Sidebar mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={() => setIsSidebarOpen(false)}
                >
                    <div
                        className="w-72 h-full bg-white shadow-xl overflow-y-auto flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="font-bold text-gray-900">Menu</h2>
                        </div>
                        <nav className="flex-1 p-4 space-y-2">
                            {navItems.map((item) => {
                                const isActive = currentView === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            onViewChange(item.id);
                                            setIsSidebarOpen(false);
                                        }}
                                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${isActive
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                    >
                                        <span className="text-xl">{item.icon}</span>
                                        <span className="font-medium">{item.label}</span>
                                    </button>
                                );
                            })}
                        </nav>
                        <div className="border-t border-gray-200 p-4">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center space-x-2 bg-red-50 text-red-600 py-3 rounded-lg hover:bg-red-100 transition"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span>Se déconnecter</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Barre de navigation inférieure - UNIQUEMENT POUR CLIENTS */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
                <div className="flex justify-around items-center h-16 px-2 max-w-md mx-auto">
                    {navItems.map((item) => {
                        const isActive = currentView === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onViewChange(item.id)}
                                className={`flex flex-col items-center justify-center flex-1 py-1 relative ${isActive ? 'text-blue-600' : 'text-gray-500'
                                    }`}
                            >
                                <span className="text-xl">{item.icon}</span>
                                <span className={`text-xs mt-0.5 ${isActive ? 'font-medium' : ''}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </>
    );
}

// src/App.tsx - Version corrigée

function AppContent() {
    const { user, loading } = useAuth();
    const { userRole, loading: permissionsLoading } = usePermissions();
    const [currentView, setCurrentView] = useState<string>('');

    // Vérifier si on est sur la route publique du menu
    const isPublicMenuRoute = window.location.pathname === '/menu';

    // Si c'est la route publique, afficher uniquement le menu
    if (isPublicMenuRoute) {
        return <MenuView />;
    }

    // Initialisation de Capacitor pour le mobile
    useEffect(() => {
        const initMobile = async () => {
            if (Capacitor.isNativePlatform()) {
                try {
                    await SplashScreen.hide();
                    await StatusBar.setStyle({ style: 'dark' });
                    await StatusBar.setBackgroundColor({ color: '#ffffff' });
                    console.log('📱 Application mobile initialisée');
                } catch (error) {
                    console.error('Erreur initialisation mobile:', error);
                }
            }
        };
        initMobile();
    }, []);

    // Déterminer la vue par défaut - UNIQUEMENT LA LOGIQUE, PAS DE RETURN
    useEffect(() => {
        if (!permissionsLoading && !currentView) {
            // Sur mobile, toujours aller vers l'interface client
            if (isMobile) {
                console.log('📱 Mode mobile détecté, rôle:', userRole);
                setCurrentView('client-menu');
            } else if (userRole === 'cashier') {
                setCurrentView('orders');
            } else {
                setCurrentView('dashboard');
            }
        }
    }, [userRole, permissionsLoading, currentView]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-xl font-semibold text-slate-700">Chargement...</div>
            </div>
        );
    }

    if (!user) {
        return <LoginForm />;
    }

    // Vérifier le rôle
    const isClient = userRole === 'client';
    const isStaff = userRole === 'cashier' || userRole === 'manager' || userRole === 'admin';

    // 📱 SUR MOBILE : UNIQUEMENT L'INTERFACE CLIENT
    if (isMobile) {
        console.log('📱 Mode mobile - Affichage client');

        // Pour le moment, on affiche l'interface client pour tous sur mobile
        // (les membres du personnel auront un message)
        return (
            <div className="min-h-screen bg-gray-50 pb-16">
                <MobileNavigation
                    currentView={currentView}
                    onViewChange={setCurrentView}
                />
                <main className="pb-20">
                    <ClientDashboard currentView={currentView} onViewChange={setCurrentView} />
                </main>
            </div>
        );
    }

    // 💻 SUR WEB : UNIQUEMENT L'INTERFACE PERSONNEL
    const renderView = () => {
        switch (currentView) {
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

    // Version desktop - UNIQUEMENT POUR LE PERSONNEL
    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar currentView={currentView} onViewChange={setCurrentView} />
            <main className="flex-1 overflow-auto">
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