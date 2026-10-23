// src/components/employees/DepartmentPositionsManager.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Building,
  Briefcase,
  Plus,
  Edit,
  Trash2,
  X,
  Check,
  Users,
  DollarSign,
  Search
} from 'lucide-react';

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

export default function DepartmentPositionsManager() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'departments' | 'positions'>('departments');
  
  // États pour les départements
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentFormData, setDepartmentFormData] = useState({
    name: '',
    description: ''
  });
  
  // États pour les postes
  const [positions, setPositions] = useState<Position[]>([]);
  const [showPositionForm, setShowPositionForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [positionFormData, setPositionFormData] = useState({
    name: '',
    department_id: '',
    description: '',
    base_salary: 0,
    salary_type: 'monthly' as 'monthly' | 'hourly' | 'daily'
  });
  
  // États pour la recherche et filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  
  // Charger les données initiales
  useEffect(() => {
    loadDepartments();
    loadPositions();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employee_departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
      alert('Erreur lors du chargement des départements');
    } finally {
      setLoading(false);
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
        // Mettre à jour le département existant
        const { error } = await supabase
          .from('employee_departments')
          .update(departmentData)
          .eq('id', editingDepartment.id);

        if (error) throw error;
        alert('Département modifié avec succès !');
      } else {
        // Créer un nouveau département
        const { error } = await supabase
          .from('employee_departments')
          .insert([departmentData]);

        if (error) {
          if (error.code === '23505') {
            alert('Un département avec ce nom existe déjà');
            return;
          }
          throw error;
        }
        alert('Département créé avec succès !');
      }

      // Réinitialiser le formulaire et recharger les données
      resetDepartmentForm();
      loadDepartments();
      loadPositions(); // Recharger aussi les postes pour les noms de département
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
        // Mettre à jour le poste existant
        const { error } = await supabase
          .from('employee_positions')
          .update(positionData)
          .eq('id', editingPosition.id);

        if (error) throw error;
        alert('Poste modifié avec succès !');
      } else {
        // Créer un nouveau poste
        const { error } = await supabase
          .from('employee_positions')
          .insert([positionData]);

        if (error) {
          if (error.code === '23505') {
            alert('Un poste avec ce nom existe déjà dans ce département');
            return;
          }
          throw error;
        }
        alert('Poste créé avec succès !');
      }

      // Réinitialiser le formulaire et recharger les données
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
      // Vérifier s'il y a des postes associés
      const { data: positions } = await supabase
        .from('employee_positions')
        .select('id')
        .eq('department_id', departmentId)
        .eq('is_active', true);

      if (positions && positions.length > 0) {
        if (!confirm(`Ce département contient ${positions.length} poste(s).\nVoulez-vous vraiment continuer ? Les postes seront également désactivés.`)) {
          return;
        }
        
        // Désactiver les postes associés
        await supabase
          .from('employee_positions')
          .update({ is_active: false })
          .eq('department_id', departmentId);
      }

      // Désactiver le département
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
      // Vérifier s'il y a des employés associés
      const { data: employees } = await supabase
        .from('employees')
        .select('id')
        .eq('position_id', positionId)
        .eq('status', 'active');

      if (employees && employees.length > 0) {
        alert(`Impossible de supprimer ce poste car ${employees.length} employé(s) l'utilisent.\nVeuillez d'abord réassigner ces employés à un autre poste.`);
        return;
      }

      // Désactiver le poste
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
    setDepartmentFormData({
      name: '',
      description: ''
    });
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

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dept.description && dept.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredPositions = positions.filter(pos => {
    const matchesSearch = 
      pos.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pos.description && pos.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDepartment = departmentFilter === 'all' || pos.department_id === departmentFilter;
    
    return matchesSearch && matchesDepartment;
  });

  // Modal pour département
  const renderDepartmentModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-900">
            {editingDepartment ? 'Modifier le Département' : 'Nouveau Département'}
          </h3>
          <button
            onClick={resetDepartmentForm}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-6 h-6" />
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
              placeholder="Description des responsabilités du département..."
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={resetDepartmentForm}
              className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition"
            >
              {editingDepartment ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Modal pour poste
  const renderPositionModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-900">
            {editingPosition ? 'Modifier le Poste' : 'Nouveau Poste'}
          </h3>
          <button
            onClick={resetPositionForm}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-6 h-6" />
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
              placeholder="Ex: Chef cuisinier, Serveur, Caissier"
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
              placeholder="Description des responsabilités du poste..."
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={resetPositionForm}
              className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition"
            >
              {editingPosition ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-lg text-slate-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Départements et Postes</h2>
          <p className="text-slate-600 mt-1 text-sm md:text-base">
            Gestion des départements et postes des employés
          </p>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab('departments')}
            className={`py-3 px-4 border-b-2 font-medium ${
              activeTab === 'departments'
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Building className="w-4 h-4 inline mr-2" />
            Départements ({departments.filter(d => d.is_active).length})
          </button>
          <button
            onClick={() => setActiveTab('positions')}
            className={`py-3 px-4 border-b-2 font-medium ${
              activeTab === 'positions'
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Briefcase className="w-4 h-4 inline mr-2" />
            Postes ({positions.filter(p => p.is_active).length})
          </button>
        </nav>
      </div>

      {/* Barre de recherche et bouton d'ajout */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder={`Rechercher un ${activeTab === 'departments' ? 'département' : 'poste'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-64 pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          {activeTab === 'positions' && (
            <div className="w-full md:w-auto">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full md:w-48 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
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
            </div>
          )}

          <button
            onClick={() => {
              if (activeTab === 'departments') {
                resetDepartmentForm();
                setShowDepartmentForm(true);
              } else {
                resetPositionForm();
                setShowPositionForm(true);
              }
            }}
            className="w-full md:w-auto bg-slate-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-700 transition flex items-center justify-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            {activeTab === 'departments' ? 'Nouveau Département' : 'Nouveau Poste'}
          </button>
        </div>
      </div>

      {/* Liste des départements */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDepartments
            .filter(dept => dept.is_active)
            .map((department) => (
              <div key={department.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-lg">{department.name}</h3>
                    {department.description && (
                      <p className="text-slate-600 text-sm mt-1">{department.description}</p>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleEditDepartment(department)}
                      className="text-slate-600 hover:text-slate-900 transition p-1"
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
                  <Users className="w-4 h-4 mr-1" />
                  <span>
                    {positions.filter(p => p.department_id === department.id && p.is_active).length} poste(s)
                  </span>
                </div>
              </div>
            ))}

          {filteredDepartments.filter(dept => dept.is_active).length === 0 && (
            <div className="md:col-span-3 text-center py-12">
              <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">
                {searchTerm ? 'Aucun département ne correspond à la recherche' : 'Aucun département enregistré'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => {
                    resetDepartmentForm();
                    setShowDepartmentForm(true);
                  }}
                  className="mt-4 bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition"
                >
                  Créer le premier département
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Liste des postes */}
      {activeTab === 'positions' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Poste
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Département
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                    Type de salaire
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">
                    Salaire de base
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden xl:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredPositions
                  .filter(pos => pos.is_active)
                  .map((position) => (
                    <tr key={position.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">{position.name}</div>
                        <div className="text-sm text-slate-500 lg:hidden">
                          {position.salary_type === 'monthly' ? 'Mensuel' : 
                           position.salary_type === 'hourly' ? 'Horaire' : 'Journalier'}
                        </div>
                        <div className="text-sm text-slate-500 md:hidden">
                          {position.base_salary.toLocaleString()} f CFA
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-slate-900">{position.department_name}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 hidden lg:table-cell">
                        {position.salary_type === 'monthly' ? 'Mensuel' : 
                         position.salary_type === 'hourly' ? 'Horaire' : 'Journalier'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 hidden md:table-cell">
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 text-slate-500 mr-1" />
                          {position.base_salary.toLocaleString()} f CFA
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-900 max-w-xs truncate hidden xl:table-cell">
                        {position.description || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEditPosition(position)}
                            className="text-slate-600 hover:text-slate-900 transition p-1"
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
            <div className="text-center py-12">
              <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">
                {searchTerm ? 'Aucun poste ne correspond aux critères' : 'Aucun poste enregistré'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => {
                    resetPositionForm();
                    setShowPositionForm(true);
                  }}
                  className="mt-4 bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition"
                >
                  Créer le premier poste
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showDepartmentForm && renderDepartmentModal()}
      {showPositionForm && renderPositionModal()}
    </div>
  );
}
