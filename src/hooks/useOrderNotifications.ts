import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface OrderNotification {
  id: string;
  order_number: string;
  status: string;
  message: string;
  created_at: string;
}

export function useOrderNotifications(orderNumber: string) {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string>('');

  useEffect(() => {
    if (!orderNumber) return;

    // S'abonner aux changements en temps réel
    const channel = supabase
      .channel(`order-${orderNumber}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'online_orders',
          filter: `order_number=eq.${orderNumber}`
        },
        (payload) => {
          const newStatus = payload.new.status;
          setCurrentStatus(newStatus);

          const statusMessages: Record<string, string> = {
            pending: 'Votre commande a été reçue',
            confirmed: 'Votre commande est confirmée',
            preparing: 'Votre commande est en préparation',
            ready: 'Votre commande est prête !',
            delivered: 'Votre commande a été livrée',
            cancelled: 'Votre commande a été annulée'
          };

          const notification: OrderNotification = {
            id: Date.now().toString(),
            order_number: orderNumber,
            status: newStatus,
            message: statusMessages[newStatus] || 'Mise à jour de votre commande',
            created_at: new Date().toISOString()
          };

          setNotifications(prev => [notification, ...prev]);

          // Afficher une notification navigateur si possible
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Terra Cotta', {
              body: notification.message,
              icon: '/logo.png'
            });
          }
        }
      )
      .subscribe();

    // Demander la permission pour les notifications
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderNumber]);

  return { notifications, currentStatus };
}
