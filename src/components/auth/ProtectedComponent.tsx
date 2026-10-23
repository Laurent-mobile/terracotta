// src/components/auth/ProtectedComponent.tsx
import { ReactNode } from 'react';
import { usePermissions } from '../../hooks/usePermissions';

interface ProtectedComponentProps {
  children: ReactNode;
  requiredPermission?: string;
  requiredRole?: 'admin' | 'manager' | 'cashier';
  requiredView?: string;
  fallback?: ReactNode;
}

export default function ProtectedComponent({
  children,
  requiredPermission,
  requiredRole,
  requiredView,
  fallback = (
    <div className="p-8 text-center">
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md mx-auto">
        <h3 className="text-lg font-semibold mb-2">Accès refusé</h3>
        <p className="text-sm">
          Vous n'avez pas les autorisations nécessaires pour accéder à cette page.
        </p>
      </div>
    </div>
  )
}: ProtectedComponentProps) {
  const { hasPermission, hasRole, canAccessView, loading } = usePermissions();

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mx-auto"></div>
        <p className="text-slate-600 mt-2">Vérification des autorisations...</p>
      </div>
    );
  }

  // Vérifier l'accès basé sur la vue
  if (requiredView && !canAccessView(requiredView)) {
    return <>{fallback}</>;
  }

  // Vérifier l'accès basé sur la permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <>{fallback}</>;
  }

  // Vérifier l'accès basé sur le rôle
  if (requiredRole && !hasRole(requiredRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
