// src/utils/pagination.ts
import { SupabaseClient } from '@supabase/supabase-js';

interface PaginationOptions {
  pageSize?: number;
  startDate?: string;
  endDate?: string;
}

export async function fetchAllPaginated(
  supabase: SupabaseClient,
  table: string,
  filter: (query: any) => any,
  options: PaginationOptions = {}
) {
  const { pageSize = 1000 } = options;
  let allData: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from(table)
      .select('*', { count: 'exact' }) // Changed from 'est' to 'exact'
      .range(from, to);

    query = filter(query);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    if (data) {
      allData = allData.concat(data);
    }

    // Continue if we got a full page OR if we haven't reached the total count
    hasMore = data && data.length === pageSize && allData.length < (count || 0);
    page++;
    
    // Safety limit to prevent infinite loops
    if (page > 100) {
      console.warn('Reached maximum pagination limit (100 pages)');
      break;
    }
  }

  return allData;
}

export async function fetchAllOrders(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
  statuses: string[] = ['paid', 'closed']
) {
  return fetchAllPaginated(supabase, 'pos_orders', (query) =>
    query
      .select('total_amount, created_at, status')
      .in('status', statuses)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false })
  );
}

export async function fetchAllPayments(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
) {
  return fetchAllPaginated(supabase, 'pos_payments', (query) =>
    query
      .select('amount_paid, payment_method, created_at')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false })
  );
}

  export async function fetchAllExpenses(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
) {
  return fetchAllPaginated(supabase, 'expenses', (query) =>
    query
      .select(`*, expense_categories(name, category_type)`)
      .or('is_deleted.is.null,is_deleted.eq.false') // 🔥 Inclure les dépenses sans champ is_deleted ou avec is_deleted = false
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .order('expense_date', { ascending: false })
  );
}

export async function fetchAllOrderItems(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
) {
  return fetchAllPaginated(supabase, 'pos_order_items', (query) =>
    query
      .select('item_name, quantity, total_price, created_at, category')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false })
  );
}

export async function fetchAllSupplierPayments(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
) {
  return fetchAllPaginated(supabase, 'supplier_order_payments', (query) =>
    query
      .select('amount, payment_method, payment_date, reference_number')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)
      .order('payment_date', { ascending: false })
  );
}
