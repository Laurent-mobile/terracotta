//src/utils/permissions.ts
import { supabase } from '../lib/supabase';

export const checkPermission = async (userId: string, permissionName: string): Promise<boolean> => {
  try {
    // Récupérer le rôle de l'utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (!profile) return false;

    // Récupérer la permission
    const { data: permission } = await supabase
      .from('permissions')
      .select('id')
      .eq('name', permissionName)
      .single();

    if (!permission) return false;

    // Vérifier si le rôle a cette permission
    const { data: rolePermission } = await supabase
      .from('role_permissions')
      .select('allowed')
      .eq('role', profile.role)
      .eq('permission_id', permission.id)
      .single();

    return rolePermission?.allowed || false;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
};

// Permissions prédéfinies pour faciliter l'utilisation
export const PERMISSIONS = {
  // Ventes
  CREATE_ORDER: 'create_order',
  VIEW_ORDERS: 'view_orders',
  EDIT_ORDER: 'edit_order',
  CANCEL_ORDER: 'cancel_order',
  PROCESS_PAYMENT: 'process_payment',
  
  // Caisse
  OPEN_CASH_REGISTER: 'open_cash_register',
  CLOSE_CASH_REGISTER: 'close_cash_register',
  VIEW_CASH_REPORTS: 'view_cash_reports',
  
  // Menu
  VIEW_MENU: 'view_menu',
  EDIT_MENU: 'edit_menu',
  ADD_MENU_ITEM: 'add_menu_item',
  
  // Stocks
  VIEW_INVENTORY: 'view_inventory',
  EDIT_INVENTORY: 'edit_inventory',
  
  // Employés
  VIEW_EMPLOYEES: 'view_employees',
  EDIT_EMPLOYEES: 'edit_employees',
  
  // Rapports
  VIEW_SALES_REPORTS: 'view_sales_reports',
  VIEW_FINANCIAL_REPORTS: 'view_financial_reports',
  
  // Paramètres
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_USERS: 'manage_users',
};
