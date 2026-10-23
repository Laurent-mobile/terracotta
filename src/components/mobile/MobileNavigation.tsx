// src/components/mobile/MobileNavigation.tsx
import { useState, useEffect } from 'react';
import {
    Home,
    ShoppingBag,
    ClipboardList,
    User,
    Menu,
    X,
    QrCode,
    Bell,
    Settings
} from 'lucide-react';
import { isMobile } from '../../utils/platform';

interface MobileNavigationProps {
    currentView: string;
    onViewChange: (view: string) => void;
    unreadCount?: number;
}

export default function MobileNavigation({
    currentView,
    onViewChange,
    unreadCount = 0
}: MobileNavigationProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);

    const navItems = [
        { id: 'dashboard', label: 'Accueil', icon: Home },
        { id: 'orders', label: 'Commandes', icon: ClipboardList },
        { id: 'cashier', label: 'Caisse', icon: ShoppingBag },
        { id: 'menu', label: 'Menu Client', icon: QrCode }
    ];

    // Si ce n'est pas mobile, ne pas afficher la navigation mobile
    if (!isMobile) return null;

    return (
        <>
            {/* Barre de navigation inférieure (mobile) */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
                <div className="flex justify-around items-center h-16 px-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    onViewChange(item.id);
                                    setIsMenuOpen(false);
                                }}
                                className={`flex flex-col items-center justify-center flex-1 py-1 relative ${isActive ? 'text-blue-600' : 'text-gray-500'
                                    }`}
                            >
                                <Icon className="w-6 h-6" />
                                <span className="text-xs mt-0.5">{item.label}</span>
                                {item.id === 'orders' && unreadCount > 0 && (
                                    <span className="absolute -top-1 right-1/4 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* Scanner QR Code (simulé) */}
            {showQRScanner && (
                <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-xl p-6 max-w-sm w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Scanner le QR Code</h3>
                            <button
                                onClick={() => setShowQRScanner(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                            <div className="text-center text-gray-500">
                                <QrCode className="w-16 h-16 mx-auto mb-2" />
                                <p>Caméra simulée</p>
                                <p className="text-sm">Scannez le QR code du menu</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setShowQRScanner(false);
                                onViewChange('menu');
                            }}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
                        >
                            Ouvrir le menu
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
