export interface Ingredient {
  id: number;
  name: string;
  category: string;
  stock_level: number;
  unit: string;
  reorder_point: number;
  cost_per_unit: number;
  created_at: string;
}

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  is_available: boolean;
  image_url: string | null;
  created_at: string;
}

export interface IngredientRequest {
  id: number;
  ingredient_id: number;
  ingredient_name: string | null;
  ingredient_unit: string;
  staff_name: string;
  quantity: number;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  notes: string | null;
}

export interface StockInLog {
  id: number;
  ingredient_id: number;
  ingredient_name: string | null;
  ingredient_unit: string;
  quantity: number;
  cost: number;
  supplier: string;
  invoice_number: string | null;
  received_at: string;
}

export interface Staff {
  id: number;
  name: string;
  role: 'admin' | 'staff';
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AnalyticsData {
  kpi: {
    total_ingredients: number;
    low_stock_count: number;
    pending_requests: number;
    total_stock_in_value: number;
  };
  revenue_trend: { date: string; revenue: number }[];
  category_distribution: { name: string; value: number }[];
  recent_requests: IngredientRequest[];
  low_stock_items: Ingredient[];
}

export interface ReportData {
  inventory_health: {
    id: number;
    name: string;
    category: string;
    stock_level: number;
    unit: string;
    reorder_point: number;
    cost_value: number;
    status: 'Normal' | 'Low Stock' | 'Out of Stock';
  }[];
  supplier_summary: {
    supplier: string;
    total_spent: number;
    shipments_count: number;
  }[];
  sales_breakdown: {
    menu_item: string;
    revenue: number;
  }[];
}
