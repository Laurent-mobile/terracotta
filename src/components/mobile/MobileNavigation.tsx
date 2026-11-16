import { useState } from 'react';
import { Home, ShoppingBag, ClipboardList, User, X, QrCode } from 'lucide-react';
import { isMobile } from '../../utils/platform';

interface MobileNavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
  unreadCount?: number;
}

export default function MobileNavigation({
  currentView,
  onViewChange,
  unreadCount = 0,
}: MobileNavigationProps) {
  const [showQRScanner, setShowQRScanner] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Accueil', icon: Home },
    { id: 'orders', label: 'Commandes', icon: ClipboardList },
    { id: 'cashier', label: 'Caisse', icon: ShoppingBag },
    { id: 'menu', label: 'Menu', icon: QrCode },
  ];

  if (!isMobile) return null;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
        <div className="bg-white/90 backdrop-blur-md border border-gray-200/50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-3xl">
          <div className="flex justify-around items-center h-16 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onViewChange(item.id);
                    if (item.id === 'menu') setShowQRScanner(true);
                  }}
                  className={`relative flex flex-col items-center justify-center flex-1 py-1 transition-all duration-300 ${
                    isActive ? 'text-blue-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'
                  }`}
                  aria-label={item.label}
                >
                  {isActive && (
                    <span className="absolute -top-2 w-8 h-1 bg-blue-600 rounded-full" />
                  )}
                  <Icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110' : ''}`} />
                  <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-blue-600' : ''}`}>
                    {item.label}
                  </span>
                  {item.id === 'orders' && unreadCount > 0 && (
                    <span className="absolute top-0 right-1/4 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Scanner QR Code Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Scanner le QR Code</h3>
              <button
                onClick={() => setShowQRScanner(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-square bg-gray-50 rounded-xl flex flex-col items-center justify-center mb-6 border-2 border-dashed border-gray-300">
              <QrCode className="w-16 h-16 text-gray-400 mb-3" />
              <p className="text-gray-600 font-medium">Caméra simulée</p>
              <p className="text-sm text-gray-400 mt-1">Scannez le QR code du menu</p>
            </div>
            <button
              onClick={() => {
                setShowQRScanner(false);
                onViewChange('menu');
              }}
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20"
            >
              Ouvrir le menu
            </button>
          </div>
        </div>
      )}
    </>
  );
}