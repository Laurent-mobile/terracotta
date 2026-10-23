// src/hooks/useClientOrders.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface ClientOrder {
    id: string;
    order_number: string;
    customer_id: string;
    customer_name: string;
    customer_phone: string;
    items: Array<{
        id: string;
        name: string;
        quantity: number;
        price: number;
        total: number;
    }>;
    subtotal: number;
    delivery_fee: number;
    total_amount: number;
    order_type: 'delivery' | 'takeaway';
    delivery_address?: string;
    status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
    payment_method?: string;
    payment_status: 'pending' | 'paid' | 'failed';
    created_at: string;
    updated_at: string;
}

export function useClientOrders() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<ClientOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Charger les commandes du client
    const loadOrders = useCallback(async () => {
        if (!user) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('online_orders')
                .select('*')
                .eq('customer_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
            setError(null);
        } catch (err: any) {
            console.error('Erreur chargement commandes:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Créer une nouvelle commande
    const createOrder = useCallback(async (orderData: Omit<ClientOrder, 'id' | 'created_at' | 'updated_at' | 'status' | 'payment_status' | 'order_number'>) => {
        if (!user) throw new Error('Utilisateur non connecté');

        try {
            // Générer le numéro de commande
            const orderNumber = `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            const { data, error } = await supabase
                .from('online_orders')
                .insert({
                    ...orderData,
                    order_number: orderNumber,
                    customer_id: user.id,
                    status: 'pending',
                    payment_status: 'pending'
                })
                .select()
                .single();

            if (error) throw error;

            // Recharger les commandes
            await loadOrders();

            return data;
        } catch (err: any) {
            console.error('Erreur création commande:', err);
            throw err;
        }
    }, [user, loadOrders]);

    // Suivre une commande en temps réel
    const trackOrder = useCallback((orderId: string, onUpdate: (order: ClientOrder) => void) => {
        const subscription = supabase
            .channel(`order-${orderId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'online_orders',
                filter: `id=eq.${orderId}`
            }, (payload) => {
                onUpdate(payload.new as ClientOrder);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    // Mettre à jour le statut d'une commande (pour le client)
    const updateOrderStatus = useCallback(async (orderId: string, status: ClientOrder['status']) => {
        try {
            const { error } = await supabase
                .from('online_orders')
                .update({ status })
                .eq('id', orderId)
                .eq('customer_id', user?.id);

            if (error) throw error;
            await loadOrders();
        } catch (err: any) {
            console.error('Erreur mise à jour statut:', err);
            throw err;
        }
    }, [user, loadOrders]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    return {
        orders,
        loading,
        error,
        loadOrders,
        createOrder,
        trackOrder,
        updateOrderStatus
    };
}
