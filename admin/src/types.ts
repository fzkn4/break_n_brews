export interface Ingredient {
  id: number;
  name: string;
  category: string;
  stock_level: number;
  unit: string;
  reorder_point: number;
  cost_per_unit: number;
  lifespan_days: number | null;
  created_at: string;
}

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  price_small?: number | null;
  price_medium?: number | null;
  price_large?: number | null;
  is_available: boolean;
  image_url: string | null;
  created_at: string;
  offered_sizes?: ('Small' | 'Regular' | 'Large')[];
  supports_sizes?: boolean;
  ingredients?: {
    ingredient_id: number;
    name: string;
    unit: string;
    default_quantity: number;
    qty_small?: number | null;
    qty_medium?: number | null;
    qty_large?: number | null;
    is_customizable: boolean;
  }[];
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
  stock_by_category?: {
    category: string;
    item_count: number;
    total_stock_value: number;
    low_stock_count: number;
    items: ReportData['inventory_health'];
  }[];
  stock_per_order?: {
    order_id: number;
    created_at: string;
    status: string;
    total_amount: number;
    deductions: {
      ingredient_name: string;
      unit: string;
      amount: number;
      menu_item: string;
      size: string;
      level: string;
    }[];
  }[];
}

export interface Review {
  id: number;
  customer_name: string;
  role: string | null;
  rating: number;
  comment: string;
  is_published: boolean;
  order_id: number | null;
  created_at: string;
}

export interface Subscriber {
  id: number;
  email: string;
  created_at: string;
}

export type OrderStatus = 'pending' | 'preparing' | 'completed' | 'cancelled';
export type CustomizationLevel = 'None' | 'Less' | 'Regular' | 'Extra';

export interface OrderItemCustomization {
  ingredient_id: number;
  name: string;
  level: CustomizationLevel;
}

export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number;
  menu_item_name: string | null;
  quantity: number;
  price_at_order: number;
  subtotal: number;
  size?: string | null;
  customizations: OrderItemCustomization[];
}

export interface Order {
  id: number;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  items: OrderItem[];
}
