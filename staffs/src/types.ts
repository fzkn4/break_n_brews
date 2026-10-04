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

export interface OrderCustomization {
  ingredient_id: number;
  name: string;
  level: 'None' | 'Less' | 'Regular' | 'Extra';
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
  /** Already parsed out of the JSON column by the backend's `to_dict()`. */
  customizations: OrderCustomization[];
}

export interface Order {
  id: number;
  status: 'pending' | 'preparing' | 'completed' | 'cancelled';
  total_amount: number;
  customer_name?: string | null;
  table_label?: string | null;
  dining?: string | null;
  channel?: string | null;
  created_at: string;
  items: OrderItem[];
}
