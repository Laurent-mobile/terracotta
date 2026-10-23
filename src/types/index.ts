// src/types/index.ts
export interface User {
  id: number;
  name: string;
  role: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  unit: string;
  current_quantity: number;
  min_quantity: number;
  unit_cost: number;
  category_id?: string;
  category?: InventoryCategory;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  deleted_at: string | null;
  deleted_by: string | null;
  original_name: string | null;
  // Nouvelles propriétés pour le stock des menus
  menu_usage?: number;
  available_for_menus?: number;
  inventory_categories?: {
    name: string;
    color: string;
  };
}

export interface InventoryTransaction {
  id: string;
  inventory_item_id: string;
  transaction_type: 'purchase' | 'sale' | 'adjustment' | 'waste';
  quantity: number;
  reference_id?: string;
  reference_type?: string;
  notes?: string;
  created_at: string;
  created_by: string;
}

export interface InventoryCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface SupplierOrder {
  id: string;
  supplier_id: string;
  order_number: string;
  order_date: string;
  expected_delivery_date?: string;
  status: 'draft' | 'ordered' | 'received' | 'cancelled' | 'partial';
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  payment_method?: string;
  payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
  amount_paid?: number;
  amount_due?: number;
  last_payment_date?: string;
}

export interface SupplierOrderItem {
  id: string;
  supplier_order_id: string;
  inventory_item_id?: string;
  name?: string;
  description?: string;
  unit?: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
  received_at?: string;
  notes?: string;
  purchase_unit?: 'bottle' | 'case' | 'carton' | 'piece';
  bottles_per_unit?: number;
  is_received: boolean;
  created_at: string;
}

export interface SupplierOrderPayment {
  id: string;
  supplier_order_id: string;
  payment_date: string;
  amount: number;
  payment_method: 'cash' | 'check' | 'mobile_money' | 'bank_transfer';
  reference_number?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierOrderStatusHistory {
  id: string;
  supplier_order_id: string;
  status: string;
  notes?: string;
  created_at: string;
  created_by: string;
}

export interface SupplierBalance {
  supplier_id: string;
  supplier_name: string;
  total_due: number;
  total_paid: number;
  remaining_balance: number;
  pending_orders: number;
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  payment_number: string;
  payment_amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'check' | 'mobile_money';
  payment_date: string;
  notes?: string;
  is_bulk_payment: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierPaymentOrder {
  id: string;
  supplier_payment_id: string;
  supplier_order_id: string;
  amount: number;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  category_id: string;
  amount: number;
  expense_date: string;
  payment_method: 'cash' | 'mobile_money';
  description?: string;
  notes?: string;
  created_at: string;
  created_by: string;
}

export interface Sale {
  id: string;
  sale_date: string;
  total_amount: number;
  payment_method: 'cash' | 'mobile_money';
  entry_method: 'manual' | 'excel' | 'cash_register' | 'table_system';
  cash_register_id?: string;
  table_id?: string;
  table_number?: number;
  notes?: string;
  created_at: string;
  created_by: string;
}

export interface CashRegister {
  id: string;
  opened_at: string;
  closed_at?: string;
  opening_balance: number;
  closing_balance?: number;
  expected_balance?: number;
  difference?: number;
  status: 'open' | 'closed';
  notes?: string;
  opened_by: string;
  closed_by?: string;
}

export interface CashRegisterSummary {
  cash: number;
  mobile_money: number;
  card: number;
  total: number;
}

export interface DashboardStats {
  dailySales: number;
  monthlyExpenses: number;
  inventoryValue: number;
  profitMargin: number;
}

// Types pour la gestion des employés
export interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address?: string;
  position: EmployeePosition;
  department: EmployeeDepartment;
  hire_date: string;
  salary_type: 'monthly' | 'hourly' | 'daily';
  base_salary: number;
  status: 'active' | 'inactive' | 'suspended';
  bank_account?: string;
  emergency_contact?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface EmployeePosition {
  id: string;
  name: string;
  department: EmployeeDepartment;
  description?: string;
  base_salary: number;
  benefits?: string[];
  is_active: boolean;
  created_at: string;
}

export interface EmployeeDepartment {
  id: string;
  name: string;
  description?: string;
  manager_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface SalaryPayment {
  id: string;
  employee_id: string;
  payment_date: string;
  period_start: string;
  period_end: string;
  base_salary: number;
  overtime_hours: number;
  overtime_rate: number;
  bonuses: number;
  advances: number;
  deductions: number;
  net_salary: number;
  payment_method: 'cash' | 'bank_transfer' | 'mobile_money';
  status: 'pending' | 'paid' | 'cancelled';
  notes?: string;
  created_at: string;
  created_by: string;
}

export interface SalaryAdvance {
  id: string;
  employee_id: string;
  advance_date: string;
  amount: number;
  reason: string;
  repayment_status: 'pending' | 'repaid' | 'partial';
  repayment_date?: string;
  notes?: string;
  created_at: string;
  created_by: string;
}

export interface Bonus {
  id: string;
  employee_id: string;
  bonus_date: string;
  amount: number;
  type: 'performance' | 'attendance' | 'holiday' | 'other';
  reason: string;
  notes?: string;
  created_at: string;
  created_by: string;
}

export interface Deduction {
  id: string;
  employee_id: string;
  deduction_date: string;
  amount: number;
  type: 'absence' | 'late' | 'damage' | 'advance' | 'other';
  reason: string;
  notes?: string;
  created_at: string;
  created_by: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: 'vacation' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'other';
  start_date: string;
  end_date: string;
  total_days: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason: string;
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  work_date: string;
  check_in?: string;
  check_out?: string;
  total_hours: number;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'holiday';
  notes?: string;
  created_at: string;
}

export interface Shift {
  id: string;
  employee_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_duration: number;
  notes?: string;
  created_at: string;
  created_by: string;
}

export type EmployeePositionType =
  | 'server'
  | 'bartender'
  | 'cashier'
  | 'chef'
  | 'cook'
  | 'delivery'
  | 'dishwasher'
  | 'manager'
  | 'admin';

export type EmployeeDepartmentType =
  | 'service'
  | 'bar'
  | 'cashier'
  | 'kitchen'
  | 'delivery'
  | 'cleaning'
  | 'management'
  | 'administration';

export type PaymentMethod =
  | 'cash'
  | 'mobile_money'
  | 'card'
  | 'bank';

export type SalesTab = 'manual' | 'import';

// Types pour les paiements
export type SupplierPaymentMethod = 'cash' | 'check' | 'mobile_money' | 'bank_transfer';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue';
export type OrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled' | 'partial';
export type PurchaseUnit = 'bottle' | 'case' | 'carton' | 'piece';

// Interfaces pour les props des composants
export interface PaymentFormData {
  payment_date: string;
  amount: string;
  payment_method: SupplierPaymentMethod;
  reference_number: string;
  notes: string;
}

export interface BulkPaymentFormData {
  supplier_id: string;
  payment_amount: string;
  payment_method: SupplierPaymentMethod;
  reference_number: string;
  notes: string;
  selected_order_ids: string[];
}

export interface PaymentStats {
  totalPaid: number;
  remainingBalance: number;
  paymentPercentage: number;
}

// Interfaces pour les réponses des API
export interface SupplierOrdersResponse {
  data: SupplierOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SupplierPaymentsResponse {
  data: SupplierOrderPayment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SupplierBalancesResponse {
  data: SupplierBalance[];
  total: number;
}

// Types pour les filtres
export interface SupplierOrdersFilter {
  search?: string;
  status?: OrderStatus | 'all';
  payment_status?: PaymentStatus | 'all';
  start_date?: string;
  end_date?: string;
  supplier_id?: string;
}

export interface SupplierPaymentsFilter {
  search?: string;
  payment_method?: SupplierPaymentMethod | 'all';
  start_date?: string;
  end_date?: string;
  supplier_id?: string;
}

// Types pour les états React
export interface SupplierOrdersState {
  orders: SupplierOrder[];
  loading: boolean;
  error: string | null;
  filters: SupplierOrdersFilter;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface SupplierPaymentsState {
  payments: SupplierOrderPayment[];
  loading: boolean;
  error: string | null;
  filters: SupplierPaymentsFilter;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

// Types pour les événements
export interface PaymentEvent {
  type: 'payment_added' | 'payment_updated' | 'payment_deleted' | 'bulk_payment';
  data: SupplierOrderPayment | SupplierPayment;
  timestamp: string;
  user_id: string;
}

// Types pour les rapports
export interface SupplierPaymentReport {
  supplier_id: string;
  supplier_name: string;
  total_orders: number;
  total_amount: number;
  total_paid: number;
  total_due: number;
  last_payment_date: string | null;
  payment_timeline: {
    date: string;
    amount: number;
    method: SupplierPaymentMethod;
  }[];
}

export interface MonthlyPaymentSummary {
  month: string;
  total_payments: number;
  payment_count: number;
  average_payment: number;
  payment_methods: {
    method: SupplierPaymentMethod;
    amount: number;
    count: number;
  }[];
}

// Types pour les formulaires temporaires
export interface TempOrderItem {
  name: string;
  quantity_ordered: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  notes?: string;
}

export interface TempPaymentItem {
  order_id: string;
  order_number: string;
  order_date: string;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  selected: boolean;
  payment_amount: string;
}

// ============================================
// TYPES POUR LE CLIENT / COMMANDE EN LIGNE
// ============================================

export type UserRole = 'admin' | 'manager' | 'cashier' | 'client';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface OnlineOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  notes?: string;
  category?: string;
  image_url?: string;
}

export interface OnlineOrder {
  id?: string;
  order_number: string;
  customer_id?: string;
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
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'new_order' | 'order_confirmed' | 'order_ready' | 'payment_received' | 'order_cancelled';
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
}

export interface UserDevice {
  id: string;
  user_id: string;
  push_token: string;
  platform: 'android' | 'ios' | 'web';
  device_model?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// TYPES POUR LES STATISTIQUES CLIENT
// ============================================

export interface ClientOrderStats {
  total_orders: number;
  total_spent: number;
  average_order: number;
  favorite_items: {
    name: string;
    count: number;
  }[];
  recent_orders: OnlineOrder[];
}