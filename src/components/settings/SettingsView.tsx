// src/components/settings/SettingsView.tsx
// src/components/settings/SettingsView.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import QRCodeManager from './QRCodeManager';
import {
  Settings,
  User,
  Shield,
  Building,
  Palette,
  Bell,
  Save,
  Upload,
  Trash2,
  Plus,
  Edit,
  Lock,
  Mail,
  AlertTriangle,
  Database,
  Users,
  Briefcase,
  QrCode
} from 'lucide-react';

interface RestaurantSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  tax_rate: number;
  logo_url: string;
  menu_image_url: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'cashier';
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface RolePermission {
  role: 'admin' | 'manager' | 'cashier';
  permission_id: string;
  allowed: boolean;
}

// Interfaces pour les départements et postes
interface Department {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  created_by: string;
  is_active: boolean;
}

interface Position {
  id: string;
  name: string;
  department_id: string;
  department_name?: string;
  description?: string;
  base_salary: number;
  salary_type: 'monthly' | 'hourly' | 'daily';
  created_at: string;
  created_by: string;
  is_active: boolean;
}

export default function SettingsView() {
  const { user, userProfile } = useAuth();
  const { settings, refreshSettings } = useRestaurant();
  
  // UNE SEULE DÉCLARATION de activeTab (avec tous les onglets)
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'permissions' | 'organization' | 'appearance' | 'qr-code' | 'maintenance'>('general');
  
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [uploadingMenuImage, setUploadingMenuImage] = useState(false);
  
  const [restaurantSettings, setRestaurantSettings] = useState<RestaurantSettings>({
    name: 'Terra Cotta',
    address: '',
    phone: '',
    email: '',
    currency: 'f CFA',
    tax_rate: 10,
    logo_url: '',
    menu_image_url: ''
  });
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  
  // États pour la gestion des départements et postes
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [showPositionForm, setShowPositionForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [departmentFormData, setDepartmentFormData] = useState({
    name: '',
    description: ''
  });
  const [positionFormData, setPositionFormData] = useState({
    name: '',
    department_id: '',
    description: '',
    base_salary: 0,
    salary_type: 'monthly' as 'monthly' | 'hourly' | 'daily'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const [userForm, setUserForm] = useState({
    email: '',
    full_name: '',
    role: 'cashier' as 'admin' | 'manager' | 'cashier',
    password: ''
  });

  useEffect(() => {
    let isMounted = true;
    
    const loadAllData = async () => {
      console.log('🔧 Début du chargement des données...');
      
      if (isMounted) {
        await loadSettings();
        await loadUsers();
      }
      
      const loadPermissions = async () => {
        setLoadingPermissions(true);
        try {
          const { data: permsData } = await supabase
            .from('permissions')
            .select('*')
            .order('category, name');

          if (isMounted && permsData) setPermissions(permsData);

          const { data: rolePermsData } = await supabase
            .from('role_permissions')
            .select('*');

          if (isMounted && rolePermsData) setRolePermissions(rolePermsData);
        } catch (error) {
          console.error('Error loading permissions:', error);
        } finally {
          if (isMounted) setLoadingPermissions(false);
        }
      };
      
      if (isMounted) {
        await loadPermissions();
        console.log('✅ Toutes les données chargées');
      }
    };

    loadAllData();

    return () => {
      isMounted = false;
      console.log('🧹 Cleanup effect');
    };
  }, []);

  useEffect(() => {
    console.log('État actuel des utilisateurs:', users);
  }, [users]);

  // Charger les départements et postes quand l'onglet organisation est actif
  useEffect(() => {
    if (activeTab === 'organization') {
      loadDepartments();
      loadPositions();
    }
  }, [activeTab]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurant_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        setRestaurantSettings(data[0]);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      console.log('Chargement des utilisateurs...');
      
      const { data, error, status, count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at');

      console.log('Status:', status);
      console.log('Erreur:', error);
      console.log('Nombre total d\'utilisateurs (count):', count);
      console.log('Données récupérées:', data);

      if (error) {
        console.error('Erreur Supabase:', error);
        throw error;
      }
      
      if (data) {
        console.log(`${data.length} utilisateurs chargés`);
        setUsers(data);
      } else {
        console.log('Aucune donnée retournée');
        setUsers([]);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Erreur lors du chargement des utilisateurs');
    }
  };

  // Fonction de synchronisation des utilisateurs manquants
  const syncMissingProfiles = async () => {
    if (!userProfile || userProfile.role !== 'admin') return;
    
    try {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) throw authError;
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id');
      
      if (profilesError) throw profilesError;
      
      const profileIds = new Set(profiles?.map(p => p.id) || []);
      const missingUsers = authUsers?.users.filter(authUser => 
        !profileIds.has(authUser.id) && authUser.email
      ) || [];
      
      if (missingUsers.length > 0) {
        console.log(`${missingUsers.length} utilisateurs manquants dans profiles`);
        
        if (confirm(`${missingUsers.length} utilisateur(s) sont dans l'authentification mais pas dans la table profiles. Voulez-vous les synchroniser ?`)) {
          const profilesToCreate = missingUsers.map(authUser => ({
            id: authUser.id,
            email: authUser.email || '',
            full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Utilisateur',
            role: authUser.user_metadata?.role || 'cashier',
            created_at: authUser.created_at
          }));
          
          const { error: insertError } = await supabase
            .from('profiles')
            .insert(profilesToCreate);
          
          if (insertError) throw insertError;
          
          alert('Synchronisation terminée !');
          loadUsers();
        }
      }
    } catch (error) {
      console.error('Erreur synchronisation:', error);
    }
  };

  // Fonctions pour les départements
  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
      alert('Erreur lors du chargement des départements');
    }
  };

  const loadPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_positions')
        .select(`
          *,
          employee_departments:department_id(name)
        `)
        .order('name');

      if (error) throw error;
      
      const formattedPositions = (data || []).map(position => ({
        ...position,
        department_name: position.employee_departments?.name || 'Non assigné'
      }));
      
      setPositions(formattedPositions);
    } catch (error) {
      console.error('Error loading positions:', error);
      alert('Erreur lors du chargement des postes');
    }
  };

  const handleDepartmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Vous devez être connecté');
      return;
    }

    if (!departmentFormData.name.trim()) {
      alert('Le nom du département est obligatoire');
      return;
    }

    try {
      const departmentData = {
        name: departmentFormData.name.trim(),
        description: departmentFormData.description.trim() || null,
        created_by: user.id,
        is_active: true
      };

      if (editingDepartment) {
        const { error } = await supabase
          .from('employee_departments')
          .update(departmentData)
          .eq('id', editingDepartment.id);

        if (error) throw error;
        alert('Département modifié avec succès !');
      } else {
        const { error } = await supabase
          .from('employee_departments')
          .insert([departmentData]);

        if (error?.code === '23505') {
          alert('Un département avec ce nom existe déjà');
          return;
        }
        if (error) throw error;
        alert('Département créé avec succès !');
      }

      resetDepartmentForm();
      loadDepartments();
      loadPositions();
    } catch (error: any) {
      console.error('Error saving department:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const handlePositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Vous devez être connecté');
      return;
    }

    if (!positionFormData.name.trim()) {
      alert('Le nom du poste est obligatoire');
      return;
    }

    if (!positionFormData.department_id) {
      alert('Veuillez sélectionner un département');
      return;
    }

    if (positionFormData.base_salary <= 0) {
      alert('Le salaire de base doit être supérieur à 0');
      return;
    }

    try {
      const positionData = {
        name: positionFormData.name.trim(),
        department_id: positionFormData.department_id,
        description: positionFormData.description.trim() || null,
        base_salary: positionFormData.base_salary,
        salary_type: positionFormData.salary_type,
        created_by: user.id,
        is_active: true
      };

      if (editingPosition) {
        const { error } = await supabase
          .from('employee_positions')
          .update(positionData)
          .eq('id', editingPosition.id);

        if (error) throw error;
        alert('Poste modifié avec succès !');
      } else {
        const { error } = await supabase
          .from('employee_positions')
          .insert([positionData]);

        if (error?.code === '23505') {
          alert('Un poste avec ce nom existe déjà dans ce département');
          return;
        }
        if (error) throw error;
        alert('Poste créé avec succès !');
      }

      resetPositionForm();
      loadPositions();
    } catch (error: any) {
      console.error('Error saving position:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    setDepartmentFormData({
      name: department.name,
      description: department.description || ''
    });
    setShowDepartmentForm(true);
  };

  const handleEditPosition = (position: Position) => {
    setEditingPosition(position);
    setPositionFormData({
      name: position.name,
      department_id: position.department_id,
      description: position.description || '',
      base_salary: position.base_salary,
      salary_type: position.salary_type
    });
    setShowPositionForm(true);
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce département ?\n\nAttention : Cette action affectera tous les postes et employés liés à ce département.')) {
      return;
    }

    try {
      const { data: positions } = await supabase
        .from('employee_positions')
        .select('id')
        .eq('department_id', departmentId)
        .eq('is_active', true);

      if (positions?.length > 0) {
        if (!confirm(`Ce département contient ${positions.length} poste(s).\nVoulez-vous vraiment continuer ? Les postes seront également désactivés.`)) {
          return;
        }
        
        await supabase
          .from('employee_positions')
          .update({ is_active: false })
          .eq('department_id', departmentId);
      }

      const { error } = await supabase
        .from('employee_departments')
        .update({ is_active: false })
        .eq('id', departmentId);

      if (error) throw error;

      alert('Département supprimé avec succès');
      loadDepartments();
      loadPositions();
    } catch (error: any) {
      console.error('Error deleting department:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleDeletePosition = async (positionId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce poste ?\n\nAttention : Cette action affectera tous les employés ayant ce poste.')) {
      return;
    }

    try {
      const { data: employees } = await supabase
        .from('employees')
        .select('id')
        .eq('position_id', positionId)
        .eq('status', 'active');

      if (employees?.length > 0) {
        alert(`Impossible de supprimer ce poste car ${employees.length} employé(s) l'utilisent.\nVeuillez d'abord réassigner ces employés à un autre poste.`);
        return;
      }

      const { error } = await supabase
        .from('employee_positions')
        .update({ is_active: false })
        .eq('id', positionId);

      if (error) throw error;

      alert('Poste supprimé avec succès');
      loadPositions();
    } catch (error: any) {
      console.error('Error deleting position:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const resetDepartmentForm = () => {
    setDepartmentFormData({ name: '', description: '' });
    setEditingDepartment(null);
    setShowDepartmentForm(false);
  };

  const resetPositionForm = () => {
    setPositionFormData({
      name: '',
      department_id: '',
      description: '',
      base_salary: 0,
      salary_type: 'monthly'
    });
    setEditingPosition(null);
    setShowPositionForm(false);
  };

  const resetUserForm = () => {
    setUserForm({
      email: '',
      full_name: '',
      role: 'cashier',
      password: ''
    });
    setEditingUser(null);
    setShowUserForm(false);
  };

  const filteredPositions = positions.filter(pos => {
    const matchesSearch = 
      pos.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pos.description && pos.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDepartment = departmentFilter === 'all' || pos.department_id === departmentFilter;
    
    return matchesSearch && matchesDepartment;
  });

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('restaurant_settings')
        .upsert(restaurantSettings, { onConflict: 'id' });

      if (error) throw error;
      
      await refreshSettings();
      alert('Paramètres sauvegardés avec succès!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSavingSettings(false);
    }
  };

  const savePermissions = async () => {
    setSavingUser(true);
    try {
      const updatePromises = rolePermissions.map(async (rolePermission) => {
        const { error } = await supabase
          .from('role_permissions')
          .upsert(
            {
              role: rolePermission.role,
              permission_id: rolePermission.permission_id,
              allowed: rolePermission.allowed
            },
            {
              onConflict: 'role,permission_id',
              ignoreDuplicates: false
            }
          );

        if (error) {
          console.error(`Error updating permission ${rolePermission.permission_id} for role ${rolePermission.role}:`, error);
          throw error;
        }
      });

      await Promise.all(updatePromises);
      alert('Permissions sauvegardées avec succès!');
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      alert(`Erreur: ${error.message}`);
    } finally {
      setSavingUser(false);
    }
  };

  const togglePermission = (role: 'admin' | 'manager' | 'cashier', permissionId: string) => {
    const existingIndex = rolePermissions.findIndex(
      rp => rp.role === role && rp.permission_id === permissionId
    );

    const newRolePermissions = [...rolePermissions];

    if (existingIndex >= 0) {
      newRolePermissions[existingIndex] = {
        ...newRolePermissions[existingIndex],
        allowed: !newRolePermissions[existingIndex].allowed
      };
    } else {
      newRolePermissions.push({
        role,
        permission_id: permissionId,
        allowed: true
      });
    }

    setRolePermissions(newRolePermissions);
  };

  const isPermissionAllowed = (role: 'admin' | 'manager' | 'cashier', permissionId: string) => {
    const permission = rolePermissions.find(
      rp => rp.role === role && rp.permission_id === permissionId
    );
    return permission ? permission.allowed : false;
  };

  const validateUserForm = () => {
    const errors: string[] = [];

    if (!userForm.full_name.trim()) {
      errors.push('Le nom complet est requis');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userForm.email)) {
      errors.push('Format d\'email invalide');
    }

    if (!editingUser && userForm.password.length < 6) {
      errors.push('Le mot de passe doit contenir au moins 6 caractères');
    }

    return errors;
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateUserForm();
    if (validationErrors.length > 0) {
      alert(validationErrors.join('\n'));
      return;
    }
    
    setSavingUser(true);
    
    try {
      if (editingUser) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: userForm.full_name,
            role: userForm.role
          })
          .eq('id', editingUser.id);

        if (error) throw error;
        alert('Utilisateur modifié avec succès!');
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userForm.email)) {
          throw new Error('Email invalide');
        }

        if (userForm.password.length < 6) {
          throw new Error('Le mot de passe doit contenir au moins 6 caractères');
        }

        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', userForm.email.trim().toLowerCase())
          .single();

        if (existingProfile) {
          throw new Error('Un utilisateur avec cet email existe déjà');
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: userForm.email.trim().toLowerCase(),
          password: userForm.password,
          options: {
            data: {
              full_name: userForm.full_name,
              role: userForm.role
            }
          }
        });

        if (authError) {
          console.error('Erreur auth:', authError);
          
          if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
            const { data: existingAuthUser } = await supabase.auth.admin.listUsers();
            const user = existingAuthUser?.users.find(u => 
              u.email?.toLowerCase() === userForm.email.toLowerCase()
            );
            
            if (user) {
              const { data: existingUserProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .single();

              if (existingUserProfile) {
                throw new Error('Cet utilisateur existe déjà dans le système');
              } else {
                await supabase.from('profiles').insert({
                  id: user.id,
                  email: userForm.email.trim().toLowerCase(),
                  full_name: userForm.full_name,
                  role: userForm.role,
                });
                alert('Profile créé pour l\'utilisateur existant');
              }
            } else {
              throw authError;
            }
          } else {
            throw authError;
          }
        } else if (authData.user) {
          const { error: profileError } = await supabase.from('profiles').insert({
            id: authData.user.id,
            email: userForm.email.trim().toLowerCase(),
            full_name: userForm.full_name,
            role: userForm.role,
          });

          if (profileError) {
            console.error('Erreur création profile:', profileError);
            if (authData.user.id) {
              await supabase.auth.admin.deleteUser(authData.user.id);
            }
            throw profileError;
          }
          
          alert('Utilisateur créé avec succès!');
        }
      }

      resetUserForm();
      loadUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      
      let errorMessage = error.message;
      if (error.message.includes('email_address_invalid')) {
        errorMessage = 'L\'adresse email est invalide. Veuillez utiliser un format valide (ex: nom@domaine.com)';
      } else if (error.message.includes('already registered') || error.message.includes('User already registered')) {
        errorMessage = 'Cet email est déjà utilisé. Essayez de réinitialiser le mot de passe.';
      } else if (error.message.includes('Password should be at least')) {
        errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
      } else if (error.message.includes('Un utilisateur avec cet email existe déjà')) {
        errorMessage = 'Un utilisateur avec cet email existe déjà dans la base de données.';
      }
      
      alert(`Erreur: ${errorMessage}`);
    } finally {
      setSavingUser(false);
    }
  };

  const handleEditUser = (userItem: UserProfile) => {
    setEditingUser(userItem);
    setUserForm({
      email: userItem.email,
      full_name: userItem.full_name,
      role: userItem.role,
      password: ''
    });
    setShowUserForm(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      await supabase.auth.admin.deleteUser(userId);

      loadUsers();
      alert('Utilisateur supprimé avec succès!');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('La taille du fichier ne doit pas dépasser 2MB');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `restaurant-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('restaurant-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('restaurant-assets')
        .getPublicUrl(filePath);

      const updatedSettings = {
        ...restaurantSettings,
        logo_url: publicUrl
      };
      
      setRestaurantSettings(updatedSettings);

      await supabase
        .from('restaurant_settings')
        .upsert(updatedSettings, { onConflict: 'id' });

      await refreshSettings();

      alert('Logo mis à jour avec succès!');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      alert('Erreur lors du téléchargement du logo');
    }
  };

  const handleMenuImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La taille du fichier ne doit pas dépasser 5MB');
      return;
    }

    setUploadingMenuImage(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `menu-${Date.now()}.${fileExt}`;
      const filePath = `menu-images/${fileName}`;

      // Supprimer l'ancienne image si elle existe
      if (restaurantSettings.menu_image_url) {
        const oldPath = restaurantSettings.menu_image_url.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('restaurant-assets').remove([`menu-images/${oldPath}`]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('restaurant-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('restaurant-assets')
        .getPublicUrl(filePath);

      const updatedSettings = {
        ...restaurantSettings,
        menu_image_url: publicUrl
      };
      
      setRestaurantSettings(updatedSettings);

      await supabase
        .from('restaurant_settings')
        .upsert(updatedSettings, { onConflict: 'id' });

      await refreshSettings();

      alert('Menu téléchargé avec succès !');
    } catch (error: any) {
      console.error('Error uploading menu image:', error);
      alert('Erreur lors du téléchargement du menu');
    } finally {
      setUploadingMenuImage(false);
    }
  };

  const handleDeleteMenuImage = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer l\'image du menu ?')) return;

    try {
      if (restaurantSettings.menu_image_url) {
        const oldPath = restaurantSettings.menu_image_url.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('restaurant-assets').remove([`menu-images/${oldPath}`]);
        }
      }

      const updatedSettings = {
        ...restaurantSettings,
        menu_image_url: ''
      };
      
      setRestaurantSettings(updatedSettings);

      await supabase
        .from('restaurant_settings')
        .upsert(updatedSettings, { onConflict: 'id' });

      await refreshSettings();

      alert('Menu supprimé avec succès !');
    } catch (error: any) {
      console.error('Error deleting menu image:', error);
      alert('Erreur lors de la suppression du menu');
    }
  };

  const handleResetDatabase = async () => {
    setShowResetModal(false);
    setResetting(true);
    
    try {
      const tablesToReset = [
        'pos_kitchen_tickets',
        'pos_kitchen_orders',
        'pos_order_items',
        'pos_payments',
        'pos_transactions',
        'pos_orders',
        'salary_payments',
        'salary_advances',
        'leave_requests',
        'deductions',
        'bonuses',
        'attendance',
        'payroll_employee_details',
        'cash_transactions',
        'cash_register_reports',
        'cash_register',
        'sale_items',
        'sales',
        'order_items_list',
        'orders_main',
        'supplier_order_status_history',
        'supplier_order_items',
        'supplier_orders',
        'purchase_items',
        'purchases',
        'inventory_transactions',
        'menu_ingredients',
        'payroll_periods',
        'profit_reports'
      ];

      for (const table of tablesToReset) {
        try {
          const { error } = await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          
          if (error) {
            console.warn(`Erreur lors de la suppression de ${table}:`, error.message);
          }
        } catch (error) {
          console.warn(`Erreur avec la table ${table}:`, error);
        }
      }

      try {
        await supabase
          .from('pos_tables')
          .update({
            status: 'available',
            current_order_id: null
          });

        await supabase
          .from('pos_menus')
          .update({
            current_servings: 0,
            is_available: true
          })
          .eq('sale_type', 'bottle');

        await supabase
          .from('inventory_items')
          .update({
            current_quantity: 0
          });

      } catch (error) {
        console.warn('Erreur lors de la réinitialisation:', error);
      }

      alert('Base de données vidée avec succès! Les données de base ont été conservées.');
      
      loadUsers();
      
    } catch (error: any) {
      console.error('Erreur lors du vidage de la base:', error);
      alert(`Erreur: ${error.message}`);
    } finally {
      setResetting(false);
    }
  };

  // Modals pour départements et postes
  const renderDepartmentModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-900">
            {editingDepartment ? 'Modifier le Département' : 'Nouveau Département'}
          </h3>
          <button onClick={resetDepartmentForm} className="text-slate-400 hover:text-slate-600">
            <Trash2 className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleDepartmentSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nom du département *
            </label>
            <input
              type="text"
              value={departmentFormData.name}
              onChange={(e) => setDepartmentFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              placeholder="Ex: Cuisine, Service, Administration"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description
            </label>
            <textarea
              value={departmentFormData.description}
              onChange={(e) => setDepartmentFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              placeholder="Description des responsabilités..."
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={resetDepartmentForm}
              className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700"
            >
              {editingDepartment ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderPositionModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-900">
            {editingPosition ? 'Modifier le Poste' : 'Nouveau Poste'}
          </h3>
          <button onClick={resetPositionForm} className="text-slate-400 hover:text-slate-600">
            <Trash2 className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handlePositionSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nom du poste *
            </label>
            <input
              type="text"
              value={positionFormData.name}
              onChange={(e) => setPositionFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              placeholder="Ex: Chef cuisinier, Serveur"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Département *
            </label>
            <select
              value={positionFormData.department_id}
              onChange={(e) => setPositionFormData(prev => ({ ...prev, department_id: e.target.value }))}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            >
              <option value="">Sélectionner un département</option>
              {departments
                .filter(dept => dept.is_active)
                .map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Type de salaire *
            </label>
            <select
              value={positionFormData.salary_type}
              onChange={(e) => setPositionFormData(prev => ({ 
                ...prev, 
                salary_type: e.target.value as 'monthly' | 'hourly' | 'daily' 
              }))}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            >
              <option value="monthly">Mensuel</option>
              <option value="hourly">Horaire</option>
              <option value="daily">Journalier</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Salaire de base (f CFA) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={positionFormData.base_salary}
              onChange={(e) => setPositionFormData(prev => ({ ...prev, base_salary: parseFloat(e.target.value) || 0 }))}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description
            </label>
            <textarea
              value={positionFormData.description}
              onChange={(e) => setPositionFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              placeholder="Description des responsabilités..."
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={resetPositionForm}
              className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700"
            >
              {editingPosition ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (loading) {
    return <div className="p-8 text-center">Chargement des paramètres...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Paramètres</h2>
          <p className="text-slate-600 mt-1">Gestion de votre restaurant</p>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
        <nav className="flex space-x-8 p-6 border-b border-slate-200 overflow-x-auto">
          <button onClick={() => setActiveTab('general')} className={`flex items-center space-x-2 py-2 px-3 rounded-lg transition ${activeTab === 'general' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
            <Building className="w-4 h-4" />
            <span>Général</span>
          </button>
          <button onClick={() => setActiveTab('users')} className={`flex items-center space-x-2 py-2 px-3 rounded-lg transition ${activeTab === 'users' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
            <User className="w-4 h-4" />
            <span>Utilisateurs</span>
          </button>
          <button onClick={() => setActiveTab('permissions')} className={`flex items-center space-x-2 py-2 px-3 rounded-lg transition ${activeTab === 'permissions' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
            <Shield className="w-4 h-4" />
            <span>Permissions</span>
          </button>
          <button onClick={() => setActiveTab('organization')} className={`flex items-center space-x-2 py-2 px-3 rounded-lg transition ${activeTab === 'organization' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
            <Users className="w-4 h-4" />
            <span>Organisation</span>
          </button>
          <button onClick={() => setActiveTab('qr-code')} className={`flex items-center space-x-2 py-2 px-3 rounded-lg transition ${activeTab === 'qr-code' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
            <QrCode className="w-4 h-4" />
            <span>QR Code</span>
          </button>
          <button onClick={() => setActiveTab('appearance')} className={`flex items-center space-x-2 py-2 px-3 rounded-lg transition ${activeTab === 'appearance' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
            <Palette className="w-4 h-4" />
            <span>Apparence</span>
          </button>
          {userProfile?.role === 'admin' && (
            <button onClick={() => setActiveTab('maintenance')} className={`flex items-center space-x-2 py-2 px-3 rounded-lg transition ${activeTab === 'maintenance' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              <Database className="w-4 h-4" />
              <span>Maintenance</span>
            </button>
          )}
        </nav>

        <div className="p-6">
          {/* ONGLET GÉNÉRAL */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-slate-900">Informations du restaurant</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nom du restaurant *
                  </label>
                  <input
                    type="text"
                    value={restaurantSettings.name}
                    onChange={(e) => setRestaurantSettings({ ...restaurantSettings, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={restaurantSettings.phone}
                    onChange={(e) => setRestaurantSettings({ ...restaurantSettings, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={restaurantSettings.email}
                    onChange={(e) => setRestaurantSettings({ ...restaurantSettings, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Devise
                  </label>
                  <select
                    value={restaurantSettings.currency}
                    onChange={(e) => setRestaurantSettings({ ...restaurantSettings, currency: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  >
                    <option value="f CFA">Franc CFA (f CFA)</option>
                    <option value="USD">Dollar US ($)</option>
                    <option value="EUR">Euro (€)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Adresse
                  </label>
                  <textarea
                    value={restaurantSettings.address}
                    onChange={(e) => setRestaurantSettings({ ...restaurantSettings, address: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Taux de TVA (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={restaurantSettings.tax_rate}
                    onChange={(e) => setRestaurantSettings({ ...restaurantSettings, tax_rate: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Logo
                  </label>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
                      {restaurantSettings.logo_url ? (
                        <img 
                          src={restaurantSettings.logo_url} 
                          alt="Logo" 
                          className="w-16 h-16 object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Building className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        id="logo-upload"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="cursor-pointer bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition inline-block"
                      >
                        <Upload className="w-4 h-4 inline mr-2" />
                        {restaurantSettings.logo_url ? 'Changer' : 'Télécharger'}
                      </label>
                      <p className="text-xs text-slate-500 mt-1">
                        PNG, JPG max. 2MB
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Image du Menu */}
              <div className="border-t pt-6 mt-4">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Image du Menu</h4>
                <div className="flex flex-col md:flex-row items-start space-y-4 md:space-y-0 md:space-x-6">
                  <div className="flex-shrink-0">
                    {restaurantSettings.menu_image_url ? (
                      <div className="relative">
                        <img 
                          src={restaurantSettings.menu_image_url} 
                          alt="Menu du restaurant" 
                          className="w-48 h-auto rounded-lg border border-slate-200 shadow-sm"
                        />
                        <button
                          onClick={handleDeleteMenuImage}
                          className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition"
                          title="Supprimer le menu"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-48 h-48 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center">
                        <Upload className="w-8 h-8 text-slate-400 mb-2" />
                        <span className="text-xs text-slate-500">Aucune image</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Télécharger l'image du menu
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="file"
                        id="menu-image-upload"
                        accept="image/*"
                        onChange={handleMenuImageUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="menu-image-upload"
                        className="cursor-pointer bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition inline-flex items-center space-x-2"
                      >
                        <Upload className="w-4 h-4" />
                        <span>{uploadingMenuImage ? 'Téléchargement...' : 'Choisir une image'}</span>
                      </label>
                      <p className="text-xs text-slate-500">
                        PNG, JPG max. 5MB
                      </p>
                    </div>
                    <div className="mt-3 text-sm text-slate-600 bg-blue-50 p-3 rounded-lg">
                      <p className="font-medium text-blue-800 mb-1">📱 Important :</p>
                      <ul className="text-xs text-blue-700 space-y-1">
                        <li>• L'image doit être claire et lisible sur mobile</li>
                        <li>• Utilisez une image de bonne qualité (recommandé : largeur 800px minimum)</li>
                        <li>• Les clients verront cette image en scannant le QR code</li>
                        <li>• Vous pouvez mettre à jour l'image à tout moment, le QR code reste le même</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-slate-200">
                <button
                  onClick={saveSettings}
                  disabled={savingSettings}
                  className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50 transition flex items-center space-x-2"
                >
                  <Save className="w-5 h-5" />
                  <span>{savingSettings ? 'Sauvegarde...' : 'Sauvegarder'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ONGLET UTILISATEURS */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-slate-900">Gestion des utilisateurs</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={syncMissingProfiles}
                    className="bg-amber-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-700 transition flex items-center space-x-2"
                    title="Synchroniser les utilisateurs manquants"
                  >
                    <Database className="w-4 h-4" />
                    <span>Synchroniser</span>
                  </button>
                  <button
                    onClick={() => setShowUserForm(true)}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-700 transition flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouvel utilisateur</span>
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Utilisateur
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Rôle
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {users.map((userItem) => (
                      <tr key={userItem.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{userItem.full_name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            userItem.role === 'admin' 
                              ? 'bg-red-100 text-red-800'
                              : userItem.role === 'manager'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {userItem.role === 'admin' ? 'Administrateur' : userItem.role === 'manager' ? 'Manager' : 'Caissier'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {userItem.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleEditUser(userItem)}
                              className="text-blue-600 hover:text-blue-900 transition"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {userItem.id !== user?.id && (
                              <button
                                onClick={() => handleDeleteUser(userItem.id)}
                                className="text-red-600 hover:text-red-900 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ONGLET PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-slate-900">Gestion des permissions</h3>
                <button
                  onClick={savePermissions}
                  disabled={savingUser || loadingPermissions}
                  className="bg-slate-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50 transition flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingUser ? 'Sauvegarde...' : 'Sauvegarder'}</span>
                </button>
              </div>

              {loadingPermissions ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mx-auto"></div>
                  <p className="text-slate-600 mt-2">Chargement des permissions...</p>
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-4">Niveaux d'accès</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {(['cashier', 'manager', 'admin'] as const).map((role) => (
                        <div key={role} className="bg-white rounded-lg border border-slate-200 p-4">
                          <h5 className="font-semibold text-slate-900 mb-3 flex items-center">
                            {role === 'admin' ? (
                              <>
                                <Settings className="w-4 h-4 mr-2 text-red-600" />
                                Administrateur
                              </>
                            ) : role === 'manager' ? (
                              <>
                                <Shield className="w-4 h-4 mr-2 text-blue-600" />
                                Manager
                              </>
                            ) : (
                              <>
                                <User className="w-4 h-4 mr-2 text-green-600" />
                                Caissier
                              </>
                            )}
                          </h5>
                          <p className="text-sm text-slate-600 mb-4">
                            {role === 'admin' 
                              ? 'Accès complet à toutes les fonctionnalités'
                              : role === 'manager'
                              ? 'Accès étendu sauf gestion des utilisateurs'
                              : 'Accès limité aux fonctions de vente et caisse'}
                          </p>
                          <div className="text-xs text-slate-500">
                            {role === 'admin' 
                              ? 'Toutes les permissions'
                              : role === 'manager'
                              ? `${permissions.filter(p => isPermissionAllowed('manager', p.id)).length}/${permissions.length} permissions`
                              : `${permissions.filter(p => isPermissionAllowed('cashier', p.id)).length}/${permissions.length} permissions`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Permission
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Caissier
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Manager
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Administrateur
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {permissions.map((permission) => (
                            <tr key={permission.id} className="hover:bg-slate-50 transition">
                              <td className="px-6 py-4">
                                <div>
                                  <div className="font-medium text-slate-900">{permission.name}</div>
                                  <div className="text-sm text-slate-600">{permission.description}</div>
                                  <div className="text-xs text-slate-400 mt-1">{permission.category}</div>
                                </div>
                              </td>
                              {(['cashier', 'manager', 'admin'] as const).map((role) => (
                                <td key={role} className="px-6 py-4 text-center">
                                  <button
                                    onClick={() => togglePermission(role, permission.id)}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                                      isPermissionAllowed(role, permission.id)
                                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                        : 'bg-red-100 text-red-600 hover:bg-red-200'
                                    }`}
                                    title={isPermissionAllowed(role, permission.id) ? 'Désactiver' : 'Activer'}
                                  >
                                    {isPermissionAllowed(role, permission.id) ? '✓' : '✗'}
                                  </button>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-6 border-t border-slate-200">
                    <div className="text-sm text-slate-600">
                      Cliquez sur les icônes pour activer/désactiver les permissions
                    </div>
                    <button
                      onClick={savePermissions}
                      disabled={savingUser}
                      className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50 transition flex items-center space-x-2"
                    >
                      <Save className="w-5 h-5" />
                      <span>{savingUser ? 'Sauvegarde...' : 'Sauvegarder les permissions'}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ONGLET ORGANISATION */}
          {activeTab === 'organization' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-slate-900">Organisation du personnel</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Départements</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {departments.filter(d => d.is_active).length}
                      </p>
                    </div>
                    <Building className="w-8 h-8 text-slate-400" />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Postes actifs</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {positions.filter(p => p.is_active).length}
                      </p>
                    </div>
                    <Briefcase className="w-8 h-8 text-slate-400" />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Départements utilisés</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {[...new Set(positions.filter(p => p.is_active).map(p => p.department_id))].length}
                      </p>
                    </div>
                    <Users className="w-8 h-8 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-lg font-semibold text-slate-900 flex items-center">
                    <Building className="w-5 h-5 mr-2 text-slate-600" />
                    Départements
                  </h4>
                  <button
                    onClick={() => {
                      resetDepartmentForm();
                      setShowDepartmentForm(true);
                    }}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-700 transition flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouveau Département</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departments
                    .filter(dept => dept.is_active)
                    .map((department) => (
                      <div key={department.id} className="bg-slate-50 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h5 className="font-semibold text-slate-900">{department.name}</h5>
                            {department.description && (
                              <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                                {department.description}
                              </p>
                            )}
                          </div>
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleEditDepartment(department)}
                              className="text-blue-600 hover:text-blue-900 transition p-1"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDepartment(department.id)}
                              className="text-red-600 hover:text-red-900 transition p-1"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center text-sm text-slate-500">
                          <Briefcase className="w-4 h-4 mr-1" />
                          <span>
                            {positions.filter(p => p.department_id === department.id && p.is_active).length} poste(s)
                          </span>
                        </div>
                      </div>
                    ))}
                </div>

                {departments.filter(dept => dept.is_active).length === 0 && (
                  <div className="text-center py-8">
                    <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600">Aucun département enregistré</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-lg font-semibold text-slate-900 flex items-center">
                    <Briefcase className="w-5 h-5 mr-2 text-slate-600" />
                    Postes
                  </h4>
                  <div className="flex items-center space-x-4">
                    <select
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                      className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="all">Tous les départements</option>
                      {departments
                        .filter(dept => dept.is_active)
                        .map(dept => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={() => {
                        resetPositionForm();
                        setShowPositionForm(true);
                      }}
                      className="bg-slate-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-700 transition flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nouveau Poste</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Poste</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Département</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 hidden md:table-cell">Type de salaire</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 hidden lg:table-cell">Salaire de base</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 hidden xl:table-cell">Description</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredPositions
                        .filter(pos => pos.is_active)
                        .map((position) => (
                          <tr key={position.id} className="hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <div className="font-medium text-slate-900">{position.name}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-slate-900">{position.department_name}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 hidden md:table-cell">
                              {position.salary_type === 'monthly' ? 'Mensuel' : 
                               position.salary_type === 'hourly' ? 'Horaire' : 'Journalier'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 hidden lg:table-cell">
                              {position.base_salary.toLocaleString()} f CFA
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-900 max-w-xs truncate hidden xl:table-cell">
                              {position.description || '-'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => handleEditPosition(position)}
                                  className="text-blue-600 hover:text-blue-900 transition p-1"
                                  title="Modifier"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeletePosition(position.id)}
                                  className="text-red-600 hover:text-red-900 transition p-1"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {filteredPositions.filter(pos => pos.is_active).length === 0 && (
                  <div className="text-center py-8">
                    <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600">
                      {searchTerm || departmentFilter !== 'all' 
                        ? 'Aucun poste ne correspond aux critères' 
                        : 'Aucun poste enregistré'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ONGLET QR CODE */}
          {activeTab === 'qr-code' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-slate-900">Gestion du QR Code du Menu</h3>
              <QRCodeManager 
                restaurantName={restaurantSettings.name}
                baseUrl={window.location.origin}
              />
            </div>
          )}

          {/* Onglet Apparence */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-slate-900">Personnalisation de l'interface</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Thème de couleur
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { name: 'Bleu', value: 'blue', color: 'bg-blue-600' },
                      { name: 'Émeraude', value: 'emerald', color: 'bg-emerald-600' },
                      { name: 'Violet', value: 'purple', color: 'bg-purple-600' },
                      { name: 'Orange', value: 'orange', color: 'bg-orange-600' }
                    ].map(theme => (
                      <button
                        key={theme.value}
                        className="flex flex-col items-center space-y-2 p-3 border rounded-lg hover:border-slate-400 transition"
                      >
                        <div className={`w-8 h-8 rounded-full ${theme.color}`}></div>
                        <span className="text-xs text-slate-600">{theme.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Mode d'affichage
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input type="radio" name="theme" defaultChecked className="text-slate-600" />
                      <span>Clair</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input type="radio" name="theme" className="text-slate-600" />
                      <span>Sombre</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input type="radio" name="theme" className="text-slate-600" />
                      <span>Automatique</span>
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Langue
                  </label>
                  <select className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent">
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-slate-200">
                <button className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition">
                  Appliquer les changements
                </button>
              </div>
            </div>
          )}

          {/* ONGLET MAINTENANCE */}
          {activeTab === 'maintenance' && userProfile?.role === 'admin' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-slate-900 flex items-center">
                <Database className="w-5 h-5 mr-2 text-slate-600" />
                Maintenance de la base de données
              </h3>
              
              <div className="space-y-4">
                <p className="text-slate-600">
                  Cette section permet de réinitialiser les données de l'application tout en conservant les données de base.
                </p>
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-800 mb-2 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    ⚠️ Action irréversible
                  </h4>
                  <p className="text-amber-700 text-sm mb-2">
                    Le vidage de la base de données supprimera définitivement :
                  </p>
                  <ul className="list-disc list-inside text-amber-700 text-sm mb-2 space-y-1">
                    <li>Toutes les commandes et transactions</li>
                    <li>L'historique de caisse et de paiements</li>
                    <li>Les rapports de profit et de ventes</li>
                    <li>Les données de paie et d'employés (hors informations de base)</li>
                    <li>Les transactions d'inventaire</li>
                  </ul>
                  <p className="text-amber-700 text-sm mb-2">
                    Les données suivantes seront conservées :
                  </p>
                  <ul className="list-disc list-inside text-emerald-700 text-sm space-y-1">
                    <li>Les utilisateurs et leurs permissions</li>
                    <li>Les informations du restaurant</li>
                    <li>Les tables et leur configuration</li>
                    <li>Le menu et les catégories</li>
                    <li>Les employés (informations de base)</li>
                    <li>Les fournisseurs</li>
                  </ul>
                </div>
                
                <button
                  onClick={() => setShowResetModal(true)}
                  disabled={resetting}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition flex items-center space-x-2"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>{resetting ? 'Vidage en cours...' : 'Vider la base de données'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de création/édition d'utilisateur */}
      {showUserForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
              </h3>
              <button
                onClick={resetUserForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nom complet *
                </label>
                <input
                  type="text"
                  value={userForm.full_name}
                  onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  required
                  disabled={!!editingUser}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rôle *
                </label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="cashier">Caissier</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Mot de passe *
                  </label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    required
                    minLength={6}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetUserForm}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50 transition"
                >
                  {savingUser ? 'Enregistrement...' : editingUser ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal pour départements et postes */}
      {showDepartmentForm && renderDepartmentModal()}
      {showPositionForm && renderPositionModal()}

      {/* Modal de confirmation pour le vidage de la base */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Confirmation de réinitialisation
                </h3>
              </div>
              
              <p className="text-slate-600 mb-6">
                Êtes-vous ABSOLUMENT sûr de vouloir vider la base de données ? Cette action est irréversible et supprimera toutes les données transactionnelles.
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-700 font-medium text-sm">
                  ⚠️ Toutes les commandes, transactions, rapports et données historiques seront PERDUES définitivement.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleResetDatabase}
                  disabled={resetting}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {resetting ? 'Vidage en cours...' : 'Oui, vider la base'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
