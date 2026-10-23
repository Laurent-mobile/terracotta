// src/hooks/usePermissions.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function usePermissions() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'cashier' | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserPermissions = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // 1. Récupérer le rôle de l'utilisateur
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile) {
          setUserRole(profile.role);

          // 2. Récupérer les permissions pour ce rôle
          const { data: rolePerms } = await supabase
            .from('role_permissions')
            .select(`
              permission_id,
              permissions!inner(name)
            `)
            .eq('role', profile.role)
            .eq('allowed', true);

          if (rolePerms) {
            const permNames = rolePerms.map(rp => rp.permissions.name);
            setPermissions(permNames);
          }
        }
      } catch (error) {
        console.error('Error loading permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserPermissions();
  }, [user]);

  // Vérifier si l'utilisateur a une permission spécifique
  const hasPermission = (permissionName: string): boolean => {
    if (!userRole) return false;
    
    // Les administrateurs ont toutes les permissions
    if (userRole === 'admin') return true;
    
    return permissions.includes(permissionName);
  };

  // Vérifier si l'utilisateur a un rôle spécifique
  const hasRole = (role: 'admin' | 'manager' | 'cashier'): boolean => {
    return userRole === role;
  };

  // Vérifier l'accès à une vue spécifique
  const canAccessView = (viewId: string): boolean => {
    // Définir les permissions requises pour chaque vue
    const viewPermissions: Record<string, string[]> = {
      'dashboard': ['view_dashboard'],
      'orders': ['view_orders'],
      'cashier': ['process_payment'],
      'menus': ['view_menu'],
      'inventory': ['view_inventory'],
      'inventory-categories': ['manage_inventory_categories'],
      'supplier-orders': ['view_supplier_orders'],
      'suppliers': ['view_suppliers'],
      'expenses': ['view_expenses'],
      'sales': ['view_sales'],
      'reports': ['view_reports'],
      'cash-register-history': ['view_cash_reports'],
      'cancelled-orders': ['view_cancelled_orders'],
      'employees': ['view_employees'],
      'settings': ['manage_settings']
    };

    const requiredPerms = viewPermissions[viewId] || [];

    // Si aucune permission n'est définie, autoriser l'accès
    if (requiredPerms.length === 0) return true;

    // Les caissiers ne peuvent pas accéder au dashboard
    if (viewId === 'dashboard' && userRole === 'cashier') return false;

    // Permissions spéciales pour les caissiers
    if (userRole === 'cashier') {
      const cashierAccess = ['view_orders', 'process_payment', 'view_menu', 'view_supplier_orders', 'view_suppliers', 'view_cancelled_orders'];
      if (cashierAccess.includes(viewId)) return true;
    }

    // Vérifier si l'utilisateur a au moins une des permissions requises
    return requiredPerms.some(perm => hasPermission(perm));
  };

  return {
    userRole,
    permissions,
    loading,
    hasPermission,
    hasRole,
    canAccessView
  };
}
