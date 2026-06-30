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

export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number;
  menu_item_name: string | null;
  quantity: number;
  price_at_order: number;
  subtotal: number;
}

export interface Order {
  id: number;
  status: 'pending' | 'completed' | 'cancelled';
  total_amount: number;
  created_at: string;
  items: OrderItem[];
}
