// src/services/onlineOrders.ts
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export interface OnlineOrderItem {
    id: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
    notes?: string;
}

export interface OnlineOrder {
    id?: string;
    order_number: string;
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    items: OnlineOrderItem[];
    subtotal: number;
    delivery_fee: number;
    total_amount: number;
    order_type: 'delivery' | 'takeaway';
    delivery_address?: string;
    status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
    payment_method?: 'cash' | 'mobile_money' | 'card';
    payment_status?: 'pending' | 'paid' | 'failed';
    cashier_id?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Notification {
    id: string;
    user_id: string;
    type: 'new_order' | 'order_confirmed' | 'order_ready' | 'payment_received';
    title: string;
    message: string;
    data: any;
    read: boolean;
    created_at: string;
}

class OnlineOrdersService {
    // === COMMANDES CLIENT ===

    // Créer une nouvelle commande en ligne
    async createOrder(order: Omit<OnlineOrder, 'id' | 'order_number' | 'status' | 'created_at' | 'updated_at'>): Promise<OnlineOrder> {
        const orderNumber = `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const { data, error } = await supabase
            .from('online_orders')
            .insert({
                order_number: orderNumber,
                customer_name: order.customer_name,
                customer_phone: order.customer_phone,
                customer_email: order.customer_email,
                items: order.items,
                subtotal: order.subtotal,
                delivery_fee: order.delivery_fee,
                total_amount: order.total_amount,
                order_type: order.order_type,
                delivery_address: order.delivery_address,
                status: 'pending',
                payment_status: 'pending'
            })
            .select()
            .single();

        if (error) throw new Error(`Erreur création commande: ${error.message}`);

        // Notifier le caissier
        await this.notifyCashier('new_order', {
            orderId: data.id,
            orderNumber: data.order_number,
            customerName: data.customer_name,
            totalAmount: data.total_amount
        });

        return data;
    }

    // Récupérer les commandes d'un client par téléphone
    async getCustomerOrders(phone: string): Promise<OnlineOrder[]> {
        const { data, error } = await supabase
            .from('online_orders')
            .select('*')
            .eq('customer_phone', phone)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Erreur récupération commandes: ${error.message}`);
        return data || [];
    }

    // Récupérer une commande par son numéro
    async getOrderByNumber(orderNumber: string): Promise<OnlineOrder | null> {
        const { data, error } = await supabase
            .from('online_orders')
            .select('*')
            .eq('order_number', orderNumber)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw new Error(`Erreur récupération commande: ${error.message}`);
        }
        return data || null;
    }

    // === COMMANDES CAISSIER ===

    // Récupérer toutes les commandes en ligne (pour le caissier)
    async getCashierOrders(status?: string): Promise<OnlineOrder[]> {
        let query = supabase
            .from('online_orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw new Error(`Erreur récupération commandes: ${error.message}`);
        return data || [];
    }

    // Récupérer les nouvelles commandes (status = pending)
    async getPendingOrders(): Promise<OnlineOrder[]> {
        return this.getCashierOrders('pending');
    }

    // Valider une commande (caissier)
    async confirmOrder(orderId: string, cashierId: string): Promise<void> {
        const { error } = await supabase
            .from('online_orders')
            .update({
                status: 'confirmed',
                cashier_id: cashierId,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (error) throw new Error(`Erreur confirmation: ${error.message}`);

        // Notifier le client
        await this.notifyCustomer(orderId, 'order_confirmed');
    }

    // Marquer une commande comme prête
    async markOrderReady(orderId: string): Promise<void> {
        const { error } = await supabase
            .from('online_orders')
            .update({
                status: 'ready',
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (error) throw new Error(`Erreur mise à jour: ${error.message}`);

        // Notifier le client
        await this.notifyCustomer(orderId, 'order_ready');
    }

    // Marquer une commande comme complétée (payée)
    async completeOrder(orderId: string, paymentMethod: 'cash' | 'mobile_money' | 'card'): Promise<void> {
        const { error } = await supabase
            .from('online_orders')
            .update({
                status: 'completed',
                payment_status: 'paid',
                payment_method: paymentMethod,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (error) throw new Error(`Erreur complétion: ${error.message}`);

        // Notifier le client
        await this.notifyCustomer(orderId, 'payment_received');
    }

    // Annuler une commande
    async cancelOrder(orderId: string, reason?: string): Promise<void> {
        const { error } = await supabase
            .from('online_orders')
            .update({
                status: 'cancelled',
                updated_at: new Date().toISOString(),
                notes: reason
            })
            .eq('id', orderId);

        if (error) throw new Error(`Erreur annulation: ${error.message}`);
    }

    // === NOTIFICATIONS ===

    // Notifier un caissier
    private async notifyCashier(type: Notification['type'], data: any): Promise<void> {
        try {
            // Récupérer tous les caissiers
            const { data: cashiers } = await supabase
                .from('profiles')
                .select('id')
                .eq('role', 'cashier');

            if (!cashiers || cashiers.length === 0) return;

            const notifications = cashiers.map(cashier => ({
                user_id: cashier.id,
                type,
                title: type === 'new_order' ? '📦 Nouvelle commande en ligne' : '🔄 Mise à jour commande',
                message: type === 'new_order'
                    ? `Commande de ${data.customerName} - ${data.totalAmount} f CFA`
                    : `Commande #${data.orderNumber} mise à jour`,
                data,
                read: false
            }));

            await supabase
                .from('notifications')
                .insert(notifications);
        } catch (error) {
            console.error('Erreur notification caissier:', error);
        }
    }

    // Notifier un client
    private async notifyCustomer(orderId: string, type: Notification['type']): Promise<void> {
        try {
            const order = await this.getOrderById(orderId);
            if (!order) return;

            // Utiliser Web Push / SMS / Email selon vos besoins
            // Pour l'instant, on enregistre une notification interne

            // Ici, vous pourriez envoyer:
            // - Une notification push via Expo/OneSignal
            // - Un SMS via un service comme Twilio
            // - Un email

            console.log(`🔔 Notification client ${order.customer_phone} pour commande ${order.order_number}: ${type}`);

            // Exemple de notification push (à implémenter avec Expo)
            // await sendPushNotification(order.customer_expo_push_token, {
            //   title: type === 'order_confirmed' ? '✅ Commande confirmée' : '🍽️ Commande prête',
            //   body: type === 'order_confirmed' 
            //     ? `Votre commande #${order.order_number} a été prise en charge`
            //     : `Votre commande #${order.order_number} est prête à être récupérée`
            // });
        } catch (error) {
            console.error('Erreur notification client:', error);
        }
    }

    private async getOrderById(orderId: string): Promise<OnlineOrder | null> {
        const { data, error } = await supabase
            .from('online_orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (error) return null;
        return data;
    }
}

export const onlineOrdersService = new OnlineOrdersService();
