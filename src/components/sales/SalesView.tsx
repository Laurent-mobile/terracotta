// src/components/sales/SalesView.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShoppingCart, Plus, Edit, Trash2, Calendar, Upload, Users, Printer, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
  current_order_id?: string;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id: string;
  is_available: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface Sale {
  id: string;
  sale_date: string;
  total_amount: number;
  payment_method: 'cash' | 'mobile_money';
  entry_method: 'manual' | 'excel' | 'cash_register' | 'table_system';
  table_id?: string;
  table_number?: number;
  notes?: string;
  created_at: string;
  created_by: string;
}

interface SaleItem {
  id: string;
  sale_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export default function SalesView() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'manual' | 'tables'>('tables');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    total_amount: 0,
    payment_method: 'cash' as 'cash' | 'mobile_money',
    notes: '',
    table_id: '',
    table_number: 0,
  });

  const [items, setItems] = useState([{ 
    item_name: '', 
    quantity: 1, 
    unit_price: 0, 
    total_price: 0,
    menu_item_id: '' 
  }]);

  useEffect(() => {
    loadSales();
    loadTablesAndMenu();
  }, [filterDate]);

  const loadTablesAndMenu = async () => {
    try {
      const [tablesRes, categoriesRes, menusRes] = await Promise.all([
        supabase.from('pos_tables').select('*').order('table_number'),
        supabase.from('pos_categories').select('*').eq('is_active', true).order('display_order'),
        supabase.from('pos_menus').select('*').eq('is_available', true),
      ]);

      setTables(tablesRes.data || []);
      setCategories(categoriesRes.data || []);
      setMenuItems(menusRes.data || []);
    } catch (error) {
      console.error('Error loading tables and menu:', error);
    }
  };

  const loadSales = async () => {
    try {
      const { data: salesData, error } = await supabase
        .from('sales')
        .select('*')
        .eq('sale_date', filterDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (salesData) {
        setSales(salesData);

        // Load sale items
        const { data: itemsData, error: itemsError } = await supabase
          .from('sale_items')
          .select('*')
          .in('sale_id', salesData.map(s => s.id));

        if (itemsError) throw itemsError;
        setSaleItems(itemsData || []);
      }
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectTableForSale = (table: Table) => {
    setSelectedTable(table);
    setFormData(prev => ({
      ...prev,
      table_id: table.id,
      table_number: table.table_number
    }));
  };

  const addMenuItem = (menuItem: MenuItem) => {
    const newItem = {
      item_name: menuItem.name,
      quantity: 1,
      unit_price: menuItem.price,
      total_price: menuItem.price,
      menu_item_id: menuItem.id
    };

    setItems([...items, newItem]);
    calculateTotal([...items, newItem]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // Préparer les données pour l'insertion
      const saleData: any = {
        sale_date: formData.sale_date,
        total_amount: formData.total_amount,
        payment_method: formData.payment_method,
        notes: formData.notes,
        entry_method: activeTab === 'tables' ? 'table_system' : 'manual',
        created_by: user.id,
      };

      // Ajouter les informations de table seulement si une table est sélectionnée
      if (selectedTable) {
        saleData.table_id = formData.table_id;
        saleData.table_number = formData.table_number;
      }

      if (editingSale) {
        const { error } = await supabase
          .from('sales')
          .update(saleData)
          .eq('id', editingSale.id);

        if (error) throw error;

        // Delete existing items and add new ones
        await supabase.from('sale_items').delete().eq('sale_id', editingSale.id);
      } else {
        const { data: sale, error } = await supabase
          .from('sales')
          .insert(saleData)
          .select()
          .single();

        if (error) throw error;

        // Add sale items
        if (sale) {
          const saleItemsData = items.map(item => ({
            sale_id: sale.id,
            item_name: item.item_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
          }));

          const { error: itemsError } = await supabase
            .from('sale_items')
            .insert(saleItemsData);

          if (itemsError) throw itemsError;
        }
      }

      resetForm();
      loadSales();
    } catch (error) {
      console.error('Error saving sale:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (sale: Sale) => {
    setEditingSale(sale);
    setFormData({
      sale_date: sale.sale_date,
      total_amount: sale.total_amount,
      payment_method: sale.payment_method,
      notes: sale.notes || '',
      table_id: sale.table_id || '',
      table_number: sale.table_number || 0,
    });

    // Load sale items for editing
    const saleItemsForSale = saleItems.filter(item => item.sale_id === sale.id);
    if (saleItemsForSale.length > 0) {
      setItems(saleItemsForSale.map(item => ({
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        menu_item_id: ''
      })));
    }

    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette vente ?')) return;

    try {
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadSales();
    } catch (error) {
      console.error('Error deleting sale:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const addItem = () => {
    setItems([...items, { item_name: '', quantity: 1, unit_price: 0, total_price: 0, menu_item_id: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
      calculateTotal(newItems);
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    
    // CORRECTION: Gérer les valeurs numériques
    if (field === 'quantity' || field === 'unit_price') {
      const numValue = parseFloat(value) || 0;
      newItems[index] = { ...newItems[index], [field]: numValue };

      if (field === 'quantity' || field === 'unit_price') {
        const quantity = field === 'quantity' ? numValue : newItems[index].quantity;
        const unit_price = field === 'unit_price' ? numValue : newItems[index].unit_price;
        newItems[index].total_price = quantity * unit_price;
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }

    setItems(newItems);
    calculateTotal(newItems);
  };

  const calculateTotal = (itemsList: any[]) => {
    const total = itemsList.reduce((sum, item) => sum + (item.total_price || 0), 0);
    setFormData(prev => ({ ...prev, total_amount: total }));
  };

  const resetForm = () => {
    setFormData({
      sale_date: new Date().toISOString().split('T')[0],
      total_amount: 0,
      payment_method: 'cash',
      notes: '',
      table_id: '',
      table_number: 0,
    });
    setItems([{ item_name: '', quantity: 1, unit_price: 0, total_price: 0, menu_item_id: '' }]);
    setEditingSale(null);
    setSelectedTable(null);
    setShowForm(false);
    setShowImport(false);
  };

  const printSaleReceipt = (sale: Sale) => {
    const itemsForSale = saleItems.filter(item => item.sale_id === sale.id);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reçu de Vente</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .info { margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; }
          .total { font-weight: bold; font-size: 1.2em; }
          .footer { margin-top: 30px; text-align: center; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>REÇU DE VENTE</h1>
          <p>Restaurant - Système de Gestion</p>
        </div>
        
        <div class="info">
          <p><strong>Date:</strong> ${new Date(sale.sale_date).toLocaleDateString('fr-FR')}</p>
          <p><strong>Heure:</strong> ${new Date(sale.created_at).toLocaleTimeString('fr-FR')}</p>
          ${sale.table_number ? `<p><strong>Table:</strong> ${sale.table_number}</p>` : ''}
          <p><strong>Mode de paiement:</strong> ${sale.payment_method === 'cash' ? 'Espèces' : 'Mobile Money'}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th>Quantité</th>
              <th>Prix Unitaire</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsForSale.map(item => `
              <tr>
                <td>${item.item_name}</td>
                <td>${item.quantity}</td>
                <td>${item.unit_price.toLocaleString()} f CFA</td>
                <td>${item.total_price.toLocaleString()} f CFA</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="total">
              <td colspan="3" align="right">Total:</td>
              <td>${sale.total_amount.toLocaleString()} f CFA</td>
            </tr>
          </tfoot>
        </table>
        
        ${sale.notes ? `
          <div class="notes">
            <strong>Notes:</strong> ${sale.notes}
          </div>
        ` : ''}
        
        <div class="footer">
          <p>Merci pour votre confiance!</p>
          <p>Reçu généré le ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const exportSalesToCSV = () => {
    const headers = ['Date', 'Table', 'Articles', 'Total', 'Mode de Paiement', 'Notes'];
    const csvData = sales.map(sale => {
      const itemsForSale = saleItems.filter(item => item.sale_id === sale.id);
      const itemsText = itemsForSale.map(item => 
        `${item.quantity}x ${item.item_name}`
      ).join('; ');
      
      return [
        new Date(sale.sale_date).toLocaleDateString('fr-FR'),
        sale.table_number || '-',
        itemsText,
        sale.total_amount.toString(),
        sale.payment_method === 'cash' ? 'Espèces' : 'Mobile Money',
        sale.notes || ''
      ];
    });

    const csv = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventes-${filterDate}.csv`;
    a.click();
  };

  const totalAmount = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
  const tableSales = sales.filter(s => s.table_number).reduce((sum, s) => sum + s.total_amount, 0);
  const manualSales = sales.filter(s => !s.table_number).reduce((sum, s) => sum + s.total_amount, 0);

  const filteredMenuItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedMenuItems = categories.map(category => ({
    ...category,
    items: filteredMenuItems.filter(item => item.category_id === category.id)
  })).filter(category => category.items.length > 0);

  if (loading) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Ventes</h2>
          <p className="text-slate-600 mt-1">Gestion des ventes quotidiennes</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowForm(true)}
            className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 transition flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Nouvelle vente</span>
          </button>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('tables')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tables'
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Ventes par Table
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'manual'
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <ShoppingCart className="w-4 h-4 inline mr-2" />
            Ventes Manuelles
          </button>
        </nav>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Total du jour</p>
          <p className="text-2xl font-bold text-slate-900">
            {totalAmount.toLocaleString()} f CFA
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {sales.length} vente(s)
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Ventes tables</p>
          <p className="text-2xl font-bold text-blue-600">
            {tableSales.toLocaleString()} f CFA
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {sales.filter(s => s.table_number).length} vente(s)
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Ventes manuelles</p>
          <p className="text-2xl font-bold text-emerald-600">
            {manualSales.toLocaleString()} f CFA
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {sales.filter(s => !s.table_number).length} vente(s)
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Date
          </label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Liste des ventes */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                {activeTab === 'tables' ? 'Table' : 'Heure'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Articles
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Montant total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Mode de paiement
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sales
              .filter(sale => 
                activeTab === 'tables' ? sale.table_number : !sale.table_number
              )
              .map((sale) => {
                const itemsForSale = saleItems.filter(item => item.sale_id === sale.id);
                return (
                  <tr key={sale.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {activeTab === 'tables' ? (
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span>Table {sale.table_number}</span>
                        </div>
                      ) : (
                        new Date(sale.created_at).toLocaleTimeString('fr-FR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {itemsForSale.map((item, index) => (
                          <div key={index} className="text-sm text-slate-600">
                            {item.quantity}x {item.item_name} - {item.total_price.toLocaleString()} f CFA
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900">
                      {sale.total_amount.toLocaleString()} f CFA
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        sale.payment_method === 'cash' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {sale.payment_method === 'cash' ? 'Espèces' : 'Mobile Money'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(sale)}
                          className="text-blue-600 hover:text-blue-900 transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sale.id)}
                          className="text-red-600 hover:text-red-900 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {sales.filter(sale => 
          activeTab === 'tables' ? sale.table_number : !sale.table_number
        ).length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">
              {activeTab === 'tables' 
                ? 'Aucune vente par table enregistrée' 
                : 'Aucune vente manuelle enregistrée'
              }
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 bg-slate-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-700 transition"
            >
              Ajouter la première vente
            </button>
          </div>
        )}
      </div>

      {/* Modal de nouvelle vente - VERSION SIMPLIFIÉE */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {editingSale ? 'Modifier la vente' : 'Nouvelle vente'}
              </h3>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informations de base */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-900">Informations de vente</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formData.sale_date}
                      onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Mode de paiement *
                    </label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="cash">Espèces</option>
                      <option value="mobile_money">Mobile Money</option>
                    </select>
                  </div>

                  {/* Sélection de table */}
                  {activeTab === 'tables' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Table
                      </label>
                      <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                        {tables.map(table => (
                          <button
                            key={table.id}
                            type="button"
                            onClick={() => selectTableForSale(table)}
                            className={`p-2 text-sm rounded border ${
                              selectedTable?.id === table.id
                                ? 'bg-blue-100 border-blue-500 text-blue-700'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            Table {table.table_number}
                          </button>
                        ))}
                      </div>
                      {selectedTable && (
                        <p className="text-sm text-green-600 mt-2">
                          Table {selectedTable.table_number} sélectionnée
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Menu pour sélection des articles */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-900">Menu</h4>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Rechercher un article..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="max-h-60 overflow-y-auto border rounded-lg">
                    {groupedMenuItems.map(category => (
                      <div key={category.id} className="border-b">
                        <div className="bg-slate-50 px-3 py-2">
                          <h5 className="font-medium text-slate-900">{category.name}</h5>
                        </div>
                        <div className="p-2">
                          {category.items.map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => addMenuItem(item)}
                              className="w-full text-left p-2 rounded hover:bg-slate-50 transition text-sm"
                            >
                              <div className="flex justify-between items-center">
                                <span>{item.name}</span>
                                <span className="font-semibold">{item.price.toLocaleString()} f CFA</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Articles de la vente */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-900">Articles de la vente</h4>
                  <button
                    type="button"
                    onClick={addItem}
                    className="bg-slate-800 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-slate-700 transition"
                  >
                    + Ajouter un article manuel
                  </button>
                </div>

                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-end border rounded-lg p-4">
                      <div className="col-span-5">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Nom de l'article *
                        </label>
                        <input
                          type="text"
                          value={item.item_name}
                          onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                          placeholder="Ex: Poulet braisé, Riz sauce, etc."
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Quantité
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        />
                      </div>

                      <div className="col-span-3">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Prix unitaire (f CFA)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        />
                      </div>

                      <div className="col-span-2 flex space-x-2">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Total
                          </label>
                          <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium">
                            {item.total_price.toLocaleString()} f CFA
                          </div>
                        </div>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="px-3 py-2 text-red-600 hover:text-red-900 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Résumé et notes */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-semibold text-slate-900">Total général:</span>
                    <span className="text-2xl font-bold text-slate-900">
                      {formData.total_amount.toLocaleString()} f CFA
                    </span>
                  </div>
                  <div className="text-sm text-slate-600">
                    {items.length} article(s) • {items.reduce((sum, item) => sum + item.quantity, 0)} unité(s)
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
                  {editingSale ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
