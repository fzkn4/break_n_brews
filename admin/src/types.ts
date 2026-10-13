export interface Ingredient {
  id: number;
  name: string;
  category: string;
  stock_level: number;
  unit: string;
  reorder_point: number;
  cost_per_unit: number;
  lifespan_days: number | null;
  is_low_stock?: boolean;
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
  /** Automatic: an ingredient is at/below its reorder point. Separate from the manual is_available switch. */
  stock_paused?: boolean;
  paused_ingredients?: string[];
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
  received_by?: string | null;
  received_at: string;
  batches?: { id: number; batch_code: string; quantity: number; expiry_date: string | null }[];
}

export type ExpiryStatus = 'expired' | 'critical' | 'soon' | 'ok' | 'unknown';

/** One delivered lot of an ingredient. Stock is drawn from use_rank 1 first (soonest expiry). */
export interface StockBatch {
  id: number;
  ingredient_id: number;
  ingredient_name: string | null;
  ingredient_unit: string;
  ingredient_category: string;
  stock_in_id: number | null;
  supplier: string | null;
  batch_code: string;
  quantity_received: number;
  quantity_remaining: number;
  /** 'YYYY-MM-DD'; null only for opening stock and manual adjustments. */
  expiry_date: string | null;
  days_left: number | null;
  expiry_status: ExpiryStatus;
  state: 'active' | 'depleted' | 'disposed';
  /** 1 = open this one next. Null for expired or finished batches. */
  use_rank: number | null;
  source: 'stock_in' | 'opening' | 'adjustment';
  received_by: string | null;
  received_at: string | null;
  disposed_at: string | null;
  disposed_quantity: number | null;
  disposed_reason: string | null;
  disposed_by: string | null;
}

export interface StockInBatchInput {
  quantity: number;
  batch_code: string | null;
  expiry_date: string;
}

export interface StockInPayload {
  ingredient_id: number;
  supplier: string;
  cost: number | null;
  invoice_number: string | null;
  received_by: string | null;
  batches: StockInBatchInput[];
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
  name: string | null;
  source: 'footer' | 'post_order' | null;
  is_active: boolean;
  unsubscribed_at: string | null;
  created_at: string;
}

/** Returned on a newly created menu item when the admin asked to email subscribers. */
export interface AnnouncementResult {
  status: 'queued' | 'skipped' | 'sent' | 'failed';
  error: string | null;
  recipient_count: number;
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

export interface NotificationRecipient {
  id: number;
  email: string;
  name: string | null;
  receives_low_stock: boolean;
  receives_daily_report: boolean;
  is_active: boolean;
  created_at: string;
}

export interface EmailLogEntry {
  id: number;
  kind: 'low_stock' | 'daily_report' | 'test' | 'new_menu';
  subject: string;
  recipients: string[];
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface NotificationSettings {
  smtp: { configured: boolean; sender: string | null; host: string };
  low_stock_alerts_enabled: boolean;
  auto_pause_products: boolean;
  daily_report_enabled: boolean;
  closing_time: string;
  timezone: string;
  next_report_at: string;
  current_business_date: string;
  last_daily_report: EmailLogEntry | null;
  low_stock_count: number;
  paused_products: string[];
}

export interface DailyReportPreview {
  subject: string;
  html: string;
  summary: {
    business_date: string;
    window_start: string;
    window_end: string;
    revenue: number;
    cogs: number;
    profit: number;
    margin: number;
    orders: number;
    items_sold: number;
    insights: { tone: 'good' | 'warn' | 'bad' | 'info'; text: string }[];
    conclusion: string;
  };
}

// ---------------- AI sales insights (backend/insights.py, forecasting.py) ----------------

export type InsightKind =
  | 'selling_well'
  | 'slowing_down'
  | 'stock_up'
  | 'use_soon'
  | 'promote'
  | 'menu_idea'
  | 'heads_up';

export interface Insight {
  kind: InsightKind;
  title: string;
  detail: string;
  action: string;
  confidence: 'high' | 'medium' | 'low';
  menu_item_ids: number[];
  ingredient_ids: number[];
  evidence: string[];
  source_urls: string[];
  suggested_quantity: number | null;
}

export interface InsightFeedback {
  insight_index: number;
  rating: 'up' | 'down';
  note: string | null;
  created_by: string | null;
  created_at: string | null;
}

export interface InsightRunSummary {
  id: number;
  status: 'running' | 'succeeded' | 'failed';
  trigger: 'manual' | 'scheduled';
  requested_by: string | null;
  model: string | null;
  summary: string | null;
  error: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  web_searches: number | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface InsightRun extends InsightRunSummary {
  insights: Insight[];
  outlook: { date: string; expectation: 'busier' | 'normal' | 'quieter'; note: string }[];
  external_factors: { title: string; impact: string; source_url: string | null }[];
  sources: { url: string; title: string; page_age: string | null }[];
  feedback: Record<string, InsightFeedback>;
}

export interface InsightSettings {
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  ai_daily_enabled: boolean;
  scheduled_hour: number;
  timezone: string;
}

export interface InsightsOverview {
  configured: boolean;
  model: string;
  settings: InsightSettings;
  latest: InsightRun | null;
  running: InsightRunSummary | null;
  last_failed: InsightRunSummary | null;
  history: InsightRunSummary[];
  cooldown_seconds: number;
}

export interface ForecastItem {
  id: number;
  name: string;
  category: string;
  price: number;
  is_available: boolean;
  stock_paused: boolean;
  units_last_7: number;
  units_prev_week_avg: number;
  change_pct: number | null;
  revenue_last_7: number;
  revenue_last_28: number;
  last_sold: string | null;
  trend: 'rising' | 'falling' | 'steady' | 'new' | 'idle' | 'no_sales';
  forecast_units_next_7: number;
}

export interface ForecastIngredient {
  id: number;
  name: string;
  category: string;
  unit: string;
  stock_level: number;
  reorder_point: number;
  cost_per_unit: number;
  is_low_stock: boolean;
  used_last_28: number;
  forecast_daily_use: number;
  forecast_use_next_7: number;
  days_of_cover: number | null;
  hits_reorder_point_on: string | null;
  runs_out_on: string | null;
  suggested_order_qty: number;
  suggested_order_cost: number;
}

export interface ExpiryRisk {
  ingredient_id: number;
  ingredient: string;
  unit: string;
  batch_id: number;
  batch_code: string;
  expiry_date: string;
  days_left: number;
  quantity_at_risk: number;
  value: number;
  kind: 'expired' | 'will_expire';
}

export interface WeatherDay {
  date: string;
  summary: string;
  temp_max_c: number | null;
  temp_min_c: number | null;
  feels_like_max_c: number | null;
  rain_mm: number | null;
  rain_chance_pct: number | null;
}

export interface SalesForecast {
  business_date: string;
  timezone: string;
  history_days: number;
  horizon_days: number;
  data_notes: string[];
  totals: {
    revenue_last_7: number;
    revenue_prev_7: number;
    revenue_change_pct: number | null;
    orders_last_7: number;
    forecast_revenue_next_7: number;
    forecast_units_next_7: number;
  };
  backtest: { accuracy_pct: number; days: { date: string; predicted: number; actual: number }[] } | null;
  forecast: { date: string; weekday: string; units: number; revenue: number }[];
  items: ForecastItem[];
  categories: { category: string; revenue_last_7: number; revenue_prev_7: number; change_pct: number | null }[];
  ingredients: ForecastIngredient[];
  expiry_risks: ExpiryRisk[];
  weather: WeatherDay[];
  weather_effects: {
    category: string;
    condition: 'rainy' | 'hot';
    avg_units_on_condition_days: number;
    avg_units_other_days: number;
    difference_pct: number;
    days_compared: [number, number];
    definition: string;
  }[];
  calendar: { date: string; weekday: string; holiday: string | null; payday: boolean; weekend: boolean }[];
  signal_errors: string[];
}
