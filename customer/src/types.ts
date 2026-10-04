// Mirrors the shapes returned by backend/models.py `to_dict()`.

export interface RecipeIngredient {
  ingredient_id: number;
  name: string;
  unit: string;
  default_quantity: number;
  qty_small?: number | null;
  qty_medium?: number | null;
  qty_large?: number | null;
  is_customizable: boolean;
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
  offered_sizes?: ProductSize[];
  supports_sizes?: boolean;
  /** Set by the backend while a recipe ingredient is at/below its reorder point; lifts on restock. */
  stock_paused?: boolean;
  paused_ingredients?: string[];
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
  lifespan_days: number | null;
  created_at: string;
}

export type OrderStatus = 'pending' | 'preparing' | 'completed' | 'cancelled';

export type CustomizationLevel = 'Less' | 'Regular' | 'Extra';
export type ProductSize = 'Small' | 'Regular' | 'Large';

export interface OrderItemCustomization {
  ingredient_id: number;
  name: string;
  level: CustomizationLevel | 'None' | string;
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

export interface CartItem {
  /** menu item id + size + the chosen levels, so two customizations of one drink stay separate rows. */
  id: string;
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  size?: ProductSize;
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
