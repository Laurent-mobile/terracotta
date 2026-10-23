// src/pages/ClientDashboard.tsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ClientCartProvider } from '../contexts/ClientCartContext';
import ClientMenu from '../components/client/ClientMenu';
import ClientCart from '../components/client/ClientCart';
import ClientCheckout from '../components/client/ClientCheckout';
import ClientOrderTracking from '../components/client/ClientOrderTracking';
import ClientOrderHistory from '../components/client/ClientOrderHistory';

interface ClientDashboardProps {
    currentView: string;
    onViewChange: (view: string) => void;
}

export default function ClientDashboard({ currentView, onViewChange }: ClientDashboardProps) {
    const { user } = useAuth();
    const [currentOrderNumber, setCurrentOrderNumber] = useState<string>('');

    const handleCheckoutSuccess = (orderNumber: string) => {
        setCurrentOrderNumber(orderNumber);
        onViewChange('client-tracking');
    };

    const handleViewOrder = (orderNumber: string) => {
        setCurrentOrderNumber(orderNumber);
        onViewChange('client-tracking');
    };

    // Rendu des différentes vues client
    const renderView = () => {
        switch (currentView) {
            case 'client-menu':
                return <ClientMenu onViewCart={() => onViewChange('client-cart')} />;

            case 'client-cart':
                return (
                    <ClientCart
                        onCheckout={() => onViewChange('client-checkout')}
                        onBack={() => onViewChange('client-menu')}
                    />
                );

            case 'client-checkout':
                return (
                    <ClientCheckout
                        onSuccess={handleCheckoutSuccess}
                        onBack={() => onViewChange('client-cart')}
                    />
                );

            case 'client-tracking':
                return (
                    <ClientOrderTracking
                        orderNumber={currentOrderNumber}
                        onBack={() => onViewChange('client-history')}
                    />
                );

            case 'client-history':
                return (
                    <ClientOrderHistory
                        onViewOrder={handleViewOrder}
                        onBack={() => onViewChange('client-menu')}
                    />
                );

            default:
                return <ClientMenu onViewCart={() => onViewChange('client-cart')} />;
        }
    };

    return (
        <ClientCartProvider>
            {renderView()}
        </ClientCartProvider>
    );
}
