// src/services/pushNotifications.ts
import { PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { supabase } from '../lib/supabase';
import { isMobile } from '../utils/platform';
import { useAuth } from '../contexts/AuthContext';

// Interface pour les données de notification
interface NotificationData {
    orderId?: string;
    orderNumber?: string;
    type?: 'new_order' | 'order_confirmed' | 'order_ready' | 'payment_received';
}

/**
 * Initialiser les notifications push
 */
export const initPushNotifications = async () => {
    if (!isMobile) {
        console.log('ℹ️ Notifications push non disponibles sur le web');
        return;
    }

    try {
        console.log('📱 Initialisation des notifications push...');

        // Demander la permission
        const permission = await PushNotifications.requestPermissions();
        console.log('Permission push:', permission);

        if (permission.receive === 'granted') {
            // Enregistrer pour les notifications
            await PushNotifications.register();
            console.log('✅ Push notifications enregistrées');

            // Écouter les événements
            PushNotifications.addListener('registration', handleRegistration);
            PushNotifications.addListener('registrationError', handleRegistrationError);
            PushNotifications.addListener('pushNotificationReceived', handlePushNotificationReceived);
            PushNotifications.addListener('pushNotificationActionPerformed', handlePushNotificationAction);
        } else {
            console.warn('⚠️ Permission push refusée');
        }
    } catch (error) {
        console.error('❌ Erreur initialisation push notifications:', error);
    }
};

/**
 * Gérer l'enregistrement du token push
 */
const handleRegistration = async (token: Token) => {
    console.log('📱 Token push reçu:', token.value);
    await savePushToken(token.value);
};

/**
 * Gérer les erreurs d'enregistrement
 */
const handleRegistrationError = (error: any) => {
    console.error('❌ Erreur enregistrement push:', error);
};

/**
 * Gérer la réception d'une notification
 */
const handlePushNotificationReceived = (notification: PushNotificationSchema) => {
    console.log('📬 Notification reçue:', notification);

    // Extraire les données de la notification
    const data = notification.data as NotificationData;

    // Afficher une notification dans le système
    if (notification.body) {
        console.log(`🔔 ${notification.title}: ${notification.body}`);
    }
};

/**
 * Gérer l'action sur une notification (clic)
 */
const handlePushNotificationAction = (notification: any) => {
    console.log('👆 Action sur notification:', notification);

    const data = notification.notification?.data as NotificationData;

    // Rediriger vers la commande si un orderId est présent
    if (data?.orderId) {
        console.log(`📦 Redirection vers la commande: ${data.orderId}`);
        // Déclencher un événement personnalisé pour la redirection
        const event = new CustomEvent('navigate-to-order', {
            detail: { orderId: data.orderId }
        });
        window.dispatchEvent(event);
    }
};

/**
 * Sauvegarder le token push dans Supabase
 */
const savePushToken = async (token: string) => {
    try {
        // Récupérer l'utilisateur actuel
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.warn('⚠️ Utilisateur non connecté, impossible de sauvegarder le token');
            return;
        }

        // Vérifier si la table user_devices existe
        try {
            // Essayer d'insérer/mettre à jour le token
            const { data, error } = await supabase
                .from('user_devices')
                .upsert({
                    user_id: user.id,
                    push_token: token,
                    platform: getPlatform(),
                    device_model: getDeviceModel(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                })
                .select();

            if (error) {
                console.error('❌ Erreur sauvegarde token:', error);

                // Si la table n'existe pas, créer une fonction pour la créer
                if (error.code === '42P01') { // Table doesn't exist
                    console.warn('⚠️ La table user_devices n\'existe pas, tentative de création...');
                    await createUserDevicesTable();
                    // Réessayer la sauvegarde
                    await savePushToken(token);
                    return;
                }

                throw error;
            }

            console.log('✅ Token push sauvegardé avec succès');
        } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde du token:', error);
        }
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde du token:', error);
    }
};

/**
 * Créer la table user_devices si elle n'existe pas
 */
const createUserDevicesTable = async () => {
    try {
        // Cette requête SQL peut être exécutée si l'utilisateur a les droits admin
        const sql = `
      CREATE TABLE IF NOT EXISTS public.user_devices (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        push_token TEXT NOT NULL,
        platform TEXT NOT NULL,
        device_model TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id)
      );
      
      ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Users can view own devices" ON public.user_devices
        FOR SELECT TO authenticated
        USING (user_id = auth.uid());
      
      CREATE POLICY "Users can insert own devices" ON public.user_devices
        FOR INSERT TO authenticated
        WITH CHECK (user_id = auth.uid());
      
      CREATE POLICY "Users can update own devices" ON public.user_devices
        FOR UPDATE TO authenticated
        USING (user_id = auth.uid());
    `;

        // Exécuter la requête via Supabase
        const { error } = await supabase.rpc('exec_sql', { sql });

        if (error) {
            console.error('❌ Erreur création table user_devices:', error);
            // Si exec_sql n'existe pas, on propose une alternative
            console.warn('💡 Veuillez exécuter manuellement la requête SQL dans Supabase');
            console.log(sql);
        } else {
            console.log('✅ Table user_devices créée avec succès');
        }
    } catch (error) {
        console.error('❌ Erreur création table:', error);
    }
};

/**
 * Obtenir la plateforme actuelle
 */
const getPlatform = (): string => {
    if (typeof window === 'undefined') return 'unknown';

    const userAgent = navigator.userAgent;
    if (userAgent.includes('Android')) return 'android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'ios';
    if (userAgent.includes('Windows')) return 'windows';
    if (userAgent.includes('Mac')) return 'macos';
    if (userAgent.includes('Linux')) return 'linux';
    return 'web';
};

/**
 * Obtenir le modèle de l'appareil
 */
const getDeviceModel = (): string => {
    try {
        return navigator.platform || 'unknown';
    } catch {
        return 'unknown';
    }
};

/**
 * Envoyer une notification à un utilisateur spécifique
 */
export const sendPushNotification = async (
    userId: string,
    title: string,
    body: string,
    data?: NotificationData
) => {
    try {
        // Récupérer le token push de l'utilisateur
        const { data: device, error } = await supabase
            .from('user_devices')
            .select('push_token')
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error('❌ Erreur récupération token:', error);
            return false;
        }

        if (!device?.push_token) {
            console.warn('⚠️ Aucun token push trouvé pour l\'utilisateur:', userId);
            return false;
        }

        // Dans un environnement de production, vous enverriez la notification via un service
        // comme OneSignal, Firebase, ou votre propre backend

        // Exemple d'envoi via votre backend Supabase
        const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                type: data?.type || 'new_order',
                title,
                message: body,
                data: data || {}
            });

        if (notificationError) {
            console.error('❌ Erreur sauvegarde notification:', notificationError);
            return false;
        }

        console.log('✅ Notification envoyée à l\'utilisateur:', userId);
        return true;

    } catch (error) {
        console.error('❌ Erreur envoi notification:', error);
        return false;
    }
};

/**
 * Envoyer une notification de nouvelle commande
 */
export const notifyNewOrder = async (cashierId: string, orderData: any) => {
    return sendPushNotification(
        cashierId,
        '📦 Nouvelle commande en ligne',
        `Commande de ${orderData.customer_name} - ${orderData.total_amount} f CFA`,
        {
            orderId: orderData.id,
            orderNumber: orderData.order_number,
            type: 'new_order'
        }
    );
};

/**
 * Envoyer une notification de commande confirmée
 */
export const notifyOrderConfirmed = async (customerId: string, orderData: any) => {
    return sendPushNotification(
        customerId,
        '✅ Commande confirmée',
        `Votre commande #${orderData.order_number} a été prise en charge`,
        {
            orderId: orderData.id,
            orderNumber: orderData.order_number,
            type: 'order_confirmed'
        }
    );
};

/**
 * Envoyer une notification de commande prête
 */
export const notifyOrderReady = async (customerId: string, orderData: any) => {
    return sendPushNotification(
        customerId,
        '🍽️ Commande prête',
        `Votre commande #${orderData.order_number} est prête à être récupérée`,
        {
            orderId: orderData.id,
            orderNumber: orderData.order_number,
            type: 'order_ready'
        }
    );
};

/**
 * Envoyer une notification de paiement reçu
 */
export const notifyPaymentReceived = async (customerId: string, orderData: any) => {
    return sendPushNotification(
        customerId,
        '💳 Paiement reçu',
        `Merci pour votre paiement de ${orderData.total_amount} f CFA pour la commande #${orderData.order_number}`,
        {
            orderId: orderData.id,
            orderNumber: orderData.order_number,
            type: 'payment_received'
        }
    );
};

// Fonction d'initialisation pour le démarrage de l'app
export const setupPushNotifications = async () => {
    if (!isMobile) {
        console.log('ℹ️ Push notifications désactivées sur le web');
        return;
    }

    await initPushNotifications();
};