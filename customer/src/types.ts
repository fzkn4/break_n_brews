// Mirrors the shapes returned by backend/models.py `to_dict()`.

export interface RecipeIngredient {
  ingredient_id: number;
  name: string;
  unit: string;
  default_quantity: number;
  is_customizable: boolean;
}

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  is_available: boolean;
  image_url: string | null;
  created_at: string;
  ingredients: RecipeIngredient[];
}

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

export type OrderStatus = 'pending' | 'preparing' | 'completed' | 'cancelled';

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
  customizations: OrderItemCustomization[];
}

export interface Order {
  id: number;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  items: OrderItem[];
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

// ----- Client-only shapes -----

export type CustomizationLevel = 'None' | 'Less' | 'Regular' | 'Extra';

export interface CartItem {
  /** menu item id + the chosen levels, so two customizations of one drink stay separate rows. */
  id: string;
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  customizations: OrderItemCustomization[];
}

export type DiningOption = 'dine_in' | 'takeaway';
export type PaymentMethod = 'cash' | 'card' | 'e_wallet';

/**
 * The orders table has no columns for who ordered or where they are sitting, so the
 * details collected at checkout are kept client-side and shown back on the tracker.
 */
export interface OrderMeta {
  orderId: number;
  name: string;
  dining: DiningOption;
  table: string;
  payment: PaymentMethod;
  placedAt: string;
}

export type View = 'home' | 'menu' | 'tracker';
