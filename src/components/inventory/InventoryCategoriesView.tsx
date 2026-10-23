//src/components/inventory/InventoryCategoriesView.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { InventoryCategory } from '../../types/database';
import { 
  Tag, Plus, Edit, Trash2, Search, 
  CheckCircle, XCircle 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface CategoryWithUsage extends InventoryCategory {
  usageCount?: number;
}

export default function InventoryCategoriesView() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategoryWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_categories')
        .select('*')
        .order('name');

      if (error) throw error;

      // Charger les counts d'usage pour chaque catégorie
      const categoriesWithUsage = await Promise.all(
        (data || []).map(async (category) => {
          const usageCount = await getCategoryUsage(category.id);
          return {
            ...category,
            usageCount
          };
        })
      );

      setCategories(categoriesWithUsage);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryUsage = async (categoryId: string) => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('category_id', categoryId)
        .eq('is_active', true);

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Error getting category usage:', error);
      return 0;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Vous devez être connecté pour créer une catégorie');
      return;
    }

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('inventory_categories')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('inventory_categories')
          .insert({
            ...formData,
            is_active: true,
            created_by: user.id,
          });

        if (error) throw error;
      }

      resetForm();
      loadCategories();
      alert(editingCategory ? 'Catégorie modifiée avec succès !' : 'Catégorie créée avec succès !');
    } catch (error: any) {
      console.error('Error saving category:', error);
      alert(`Erreur lors de la sauvegarde: ${error.message}`);
    }
  };

  const toggleCategoryStatus = async (category: InventoryCategory) => {
    if (!confirm(`Êtes-vous sûr de vouloir ${category.is_active ? 'désactiver' : 'activer'} cette catégorie ?`)) return;

    try {
      const { error } = await supabase
        .from('inventory_categories')
        .update({
          is_active: !category.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', category.id);

      if (error) throw error;

      loadCategories();
      alert(`Catégorie ${!category.is_active ? 'activée' : 'désactivée'} avec succès !`);
    } catch (error: any) {
      console.error('Error toggling category status:', error);
      alert(`Erreur lors de la modification: ${error.message}`);
    }
  };

  const handleEdit = (category: InventoryCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color || '#3B82F6',
    });
    setShowForm(true);
  };

  const canDeleteCategory = async (categoryId: string) => {
    const usageCount = await getCategoryUsage(categoryId);
    return usageCount === 0;
  };

  const handleDelete = async (category: InventoryCategory) => {
    const canDelete = await canDeleteCategory(category.id);
    
    if (!canDelete) {
      alert('Cette catégorie ne peut pas être supprimée car elle est utilisée par des articles d\'inventaire.');
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ? Cette action est irréversible.')) return;

    try {
      const { error } = await supabase
        .from('inventory_categories')
        .delete()
        .eq('id', category.id);

      if (error) throw error;

      loadCategories();
      alert('Catégorie supprimée avec succès !');
    } catch (error: any) {
      console.error('Error deleting category:', error);
      alert(`Erreur lors de la suppression: ${error.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6',
    });
    setEditingCategory(null);
    setShowForm(false);
  };

  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && category.is_active) ||
      (statusFilter === 'inactive' && !category.is_active);
    return matchesSearch && matchesStatus;
  });

  const predefinedColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  if (loading) {
    return <div className="p-8 text-center">Chargement des catégories...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Catégories d'Inventaire</h2>
          <p className="text-slate-600 mt-1">Gestion des catégories pour organiser votre inventaire</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Nouvelle Catégorie</span>
        </button>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Rechercher
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Nom ou description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Statut
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actives</option>
              <option value="inactive">Inactives</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="text-sm text-slate-600">
              {filteredCategories.length} catégorie(s) trouvée(s)
            </div>
          </div>
        </div>
      </div>

      {/* Liste des catégories - CORRIGÉ : pas de async dans le map */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCategories.map((category) => (
          <div key={category.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: category.color || '#3B82F6' }}
                ></div>
                <h3 className="text-lg font-semibold text-slate-900">{category.name}</h3>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                category.is_active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {category.is_active ? (
                  <CheckCircle className="w-3 h-3 mr-1" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1" />
                )}
                {category.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            {category.description && (
              <p className="text-sm text-slate-600 mb-4">{category.description}</p>
            )}

            <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
              <span>{category.usageCount || 0} article(s) utilisent cette catégorie</span>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div className="text-xs text-slate-500">
                Créé le {new Date(category.created_at).toLocaleDateString('fr-FR')}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleEdit(category)}
                  className="text-blue-600 hover:text-blue-900 transition p-1"
                  title="Modifier"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleCategoryStatus(category)}
                  className={`p-1 transition ${
                    category.is_active 
                      ? 'text-orange-600 hover:text-orange-900' 
                      : 'text-green-600 hover:text-green-900'
                  }`}
                  title={category.is_active ? 'Désactiver' : 'Activer'}
                >
                  {category.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleDelete(category)}
                  className="text-red-600 hover:text-red-900 transition p-1"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCategories.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
          <Tag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">
            {searchTerm || statusFilter !== 'all' 
              ? 'Aucune catégorie ne correspond aux critères' 
              : 'Aucune catégorie créée'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition"
            >
              Créer la première catégorie
            </button>
          )}
        </div>
      )}

      {/* Modal de création/édition */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
              </h3>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nom de la catégorie *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  placeholder="Ex: Légumes, Viandes, Boissons..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  placeholder="Description de la catégorie..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Couleur
                </label>
                <div className="space-y-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full h-10 border border-slate-300 rounded-lg cursor-pointer"
                  />
                  
                  <div className="grid grid-cols-5 gap-2">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded-full border-2 ${
                          formData.color === color ? 'border-slate-800' : 'border-slate-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition"
                >
                  {editingCategory ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
