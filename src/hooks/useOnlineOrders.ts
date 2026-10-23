// src/hooks/useOnlineOrders.ts
import { useState, useEffect, useCallback } from 'react';
import { onlineOrdersService, OnlineOrder, Notification } from '../services/onlineOrders';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function useOnlineOrders() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<OnlineOrder[]>([]);
    const [pendingOrders, setPendingOrders] = useState<OnlineOrder[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Charger les commandes
    const loadOrders = useCallback(async () => {
        try {
            setLoading(true);
            const [allOrders, pending] = await Promise.all([
                onlineOrdersService.getCashierOrders(),
                onlineOrdersService.getPendingOrders()
            ]);
            setOrders(allOrders);
            setPendingOrders(pending);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Charger les notifications
    const loadNotifications = useCallback(async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setNotifications(data || []);
            setUnreadCount((data || []).filter(n => !n.read).length);
        } catch (err: any) {
            console.error('Erreur chargement notifications:', err);
        }
    }, [user]);

    // Valider une commande
    const confirmOrder = useCallback(async (orderId: string) => {
        if (!user) return;
        try {
            await onlineOrdersService.confirmOrder(orderId, user.id);
            await loadOrders();
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    }, [user, loadOrders]);

    // Marquer comme prête
    const markReady = useCallback(async (orderId: string) => {
        try {
            await onlineOrdersService.markOrderReady(orderId);
            await loadOrders();
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    }, [loadOrders]);

    // Compléter une commande
    const completeOrder = useCallback(async (orderId: string, paymentMethod: 'cash' | 'mobile_money' | 'card') => {
        try {
            await onlineOrdersService.completeOrder(orderId, paymentMethod);
            await loadOrders();
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    }, [loadOrders]);

    // Marquer une notification comme lue
    const markNotificationRead = useCallback(async (notificationId: string) => {
        try {
            await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', notificationId);

            setNotifications(prev => prev.map(n =>
                n.id === notificationId ? { ...n, read: true } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err: any) {
            console.error('Erreur marquage notification:', err);
        }
    }, []);

    // Écouter les changements en temps réel
    useEffect(() => {
        if (!user) return;

        loadOrders();
        loadNotifications();

        // Souscription aux nouvelles commandes
        const ordersSubscription = supabase
            .channel('online-orders')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'online_orders'
            }, () => {
                loadOrders();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'online_orders',
                filter: `status=eq.pending`
            }, () => {
                loadOrders();
            })
            .subscribe();

        // Souscription aux notifications
        const notificationsSubscription = supabase
            .channel('notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                setNotifications(prev => [payload.new as Notification, ...prev]);
                setUnreadCount(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ordersSubscription);
            supabase.removeChannel(notificationsSubscription);
        };
    }, [user, loadOrders, loadNotifications]);

    return {
        orders,
        pendingOrders,
        notifications,
        unreadCount,
        loading,
        error,
        loadOrders,
        confirmOrder,
        markReady,
        completeOrder,
        markNotificationRead
    };
}
