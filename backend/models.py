import json
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

from sqlalchemy import inspect, text

db = SQLAlchemy()

CATEGORY_LIFESPAN_DAYS = {
    'Dairy': 7,
    'Meat': 5,
    'Pastries': 14,
    'Coffee Beans': 60,
    'Syrups': 90,
    'Packaging': 365,
    'Beverages': 180,
    'Grains': 180,
    'Sweeteners': 365,
}


def default_lifespan_days(category):
    return CATEGORY_LIFESPAN_DAYS.get(category, 30)


def ensure_ingredient_lifespan_column():
    """Add lifespan_days to existing databases without wiping data."""
    insp = inspect(db.engine)
    if not insp.has_table('ingredients'):
        return
    columns = {col['name'] for col in insp.get_columns('ingredients')}

    with db.engine.begin() as conn:
        if 'lifespan_days' not in columns:
            conn.execute(text('ALTER TABLE ingredients ADD COLUMN lifespan_days INTEGER'))
            print('Added ingredients.lifespan_days column')
        conn.execute(text("""
            UPDATE ingredients SET lifespan_days = CASE
                WHEN name = 'Ice Cubes' THEN 1
                WHEN name = 'Fresh Eggs' THEN 21
                WHEN name = 'Oat Milk' THEN 14
                WHEN name = 'Cooking Oil' THEN 180
                WHEN name = 'Caramel Sauce' THEN 60
                WHEN name LIKE '%Croissant%' THEN 30
                WHEN category = 'Dairy' THEN 7
                WHEN category = 'Meat' THEN 5
                WHEN category = 'Pastries' THEN 14
                WHEN category = 'Coffee Beans' THEN 60
                WHEN category = 'Syrups' THEN 90
                WHEN category = 'Packaging' THEN 365
                WHEN category = 'Beverages' THEN 180
                WHEN category = 'Grains' THEN 180
                WHEN category = 'Sweeteners' THEN 365
                ELSE 30
            END
            WHERE lifespan_days IS NULL
        """))


SIZE_LEVELS = ('Small', 'Regular', 'Large')
LEVEL_MULTIPLIERS = {'None': 0.0, 'Less': 0.5, 'Regular': 1.0, 'Extra': 1.5}


def is_sizeable_category(category: str) -> bool:
    c = (category or '').lower().strip()
    if any(x in c for x in ('alcohol', 'beer', 'wine', 'can')):
        return False
    return (
        c in ('coffee', 'coffees', 'iced coffee', 'iced coffees')
        or 'platter' in c
        or 'rice bowl' in c
        or 'rice meal' in c
    )


def is_auto_customizable(ingredient) -> bool:
    if not ingredient:
        return False
    if (ingredient.category or '') == 'Packaging':
        return False
    return (ingredient.unit or '') in ('kg', 'mg', 'L', 'ml', 'g')


def recipe_qty_for_size(recipe_item, size='Regular') -> float:
    base = float(recipe_item.default_quantity or 0)
    if size == 'Small':
        q = recipe_item.qty_small
        return float(q) if q is not None else base * 0.75
    if size == 'Large':
        q = recipe_item.qty_large
        return float(q) if q is not None else base * 1.25
    q = recipe_item.qty_medium
    return float(q) if q is not None else base


def ensure_recipe_size_columns():
    """Add recipe size qty columns and order item size for existing databases."""
    insp = inspect(db.engine)
    with db.engine.begin() as conn:
        if insp.has_table('menu_item_ingredients'):
            columns = {col['name'] for col in insp.get_columns('menu_item_ingredients')}
            if 'qty_small' not in columns:
                conn.execute(text('ALTER TABLE menu_item_ingredients ADD COLUMN qty_small FLOAT'))
                print('Added menu_item_ingredients.qty_small column')
            if 'qty_medium' not in columns:
                conn.execute(text('ALTER TABLE menu_item_ingredients ADD COLUMN qty_medium FLOAT'))
                print('Added menu_item_ingredients.qty_medium column')
            if 'qty_large' not in columns:
                conn.execute(text('ALTER TABLE menu_item_ingredients ADD COLUMN qty_large FLOAT'))
                print('Added menu_item_ingredients.qty_large column')
        if insp.has_table('menu_items'):
            columns = {col['name'] for col in insp.get_columns('menu_items')}
            if 'offered_sizes' not in columns:
                conn.execute(text('ALTER TABLE menu_items ADD COLUMN offered_sizes TEXT'))
                print('Added menu_items.offered_sizes column')
            if 'price_small' not in columns:
                conn.execute(text('ALTER TABLE menu_items ADD COLUMN price_small NUMERIC(10, 2)'))
                print('Added menu_items.price_small column')
            if 'price_medium' not in columns:
                conn.execute(text('ALTER TABLE menu_items ADD COLUMN price_medium NUMERIC(10, 2)'))
                print('Added menu_items.price_medium column')
            if 'price_large' not in columns:
                conn.execute(text('ALTER TABLE menu_items ADD COLUMN price_large NUMERIC(10, 2)'))
                print('Added menu_items.price_large column')
        if insp.has_table('order_items'):
            columns = {col['name'] for col in insp.get_columns('order_items')}
            if 'size' not in columns:
                conn.execute(text('ALTER TABLE order_items ADD COLUMN size VARCHAR(20)'))
                print('Added order_items.size column')


def normalize_offered_sizes(raw) -> list:
    """Keep only Small/Regular/Large, in that order."""
    if raw is None:
        return []
    if isinstance(raw, str):
        text_value = raw.strip()
        if not text_value:
            return []
        try:
            raw = json.loads(text_value)
        except (TypeError, ValueError):
            raw = [part.strip() for part in text_value.split(',')]
    if not isinstance(raw, (list, tuple)):
        return []
    mapped = ['Regular' if s == 'Medium' else s for s in raw]
    return [size for size in SIZE_LEVELS if size in mapped]


def offered_sizes_for(menu_item) -> list:
    """Sizes the admin turned on for this product.

    A null column means the row predates per-product sizes, so coffee, platters,
    and rice meals keep offering Small/Regular/Large.
    """
    raw = getattr(menu_item, 'offered_sizes', None)
    if raw is None:
        return list(SIZE_LEVELS) if is_sizeable_category(getattr(menu_item, 'category', '')) else []
    return normalize_offered_sizes(raw)


def ensure_order_guest_columns():
    """Remember who ordered and which table, so a QR scan is visible on the kitchen ticket."""
    insp = inspect(db.engine)
    if not insp.has_table('orders'):
        return
    columns = {col['name'] for col in insp.get_columns('orders')}
    with db.engine.begin() as conn:
        # IF NOT EXISTS keeps a burst of first requests from failing when two of them migrate together.
        if 'customer_name' not in columns:
            conn.execute(text('ALTER TABLE orders ADD COLUMN customer_name VARCHAR(100)'))
            print('Added orders.customer_name column')
        if 'table_label' not in columns:
            conn.execute(text('ALTER TABLE orders ADD COLUMN table_label VARCHAR(20)'))
            print('Added orders.table_label column')
        if 'dining' not in columns:
            conn.execute(text('ALTER TABLE orders ADD COLUMN dining VARCHAR(20)'))
            print('Added orders.dining column')
        if 'channel' not in columns:
            conn.execute(text('ALTER TABLE orders ADD COLUMN channel VARCHAR(20)'))
            print('Added orders.channel column')


def order_size_for(menu_item, requested=None):
    """Size to charge stock against. None when this product has no sizes."""
    offered = offered_sizes_for(menu_item)
    if not offered:
        return None
    if requested == 'Medium':
        requested = 'Regular'
    if requested in offered:
        return requested
    if 'Regular' in offered:
        return 'Regular'
    return offered[0]


class Staff(db.Model):
    __tablename__ = 'staff'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), default='staff')  # admin, staff
    email = db.Column(db.String(100), unique=True, nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    password_hash = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'role': self.role,
            'email': self.email,
            'phone': self.phone,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat()
        }

class Ingredient(db.Model):
    __tablename__ = 'ingredients'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    category = db.Column(db.String(50), nullable=False)  # e.g., Coffee Beans, Dairy, Syrups, Packaging, Pastries
    stock_level = db.Column(db.Float, nullable=False, default=0.0)
    unit = db.Column(db.String(20), nullable=False)  # e.g., kg, L, pcs, bags
    reorder_point = db.Column(db.Float, nullable=False, default=5.0)
    cost_per_unit = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    lifespan_days = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    requests = db.relationship('IngredientRequest', backref='ingredient', lazy=True, cascade="all, delete-orphan")
    stock_ins = db.relationship('StockInLog', backref='ingredient', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'stock_level': self.stock_level,
            'unit': self.unit,
            'reorder_point': self.reorder_point,
            'cost_per_unit': float(self.cost_per_unit),
            'lifespan_days': self.lifespan_days,
            'created_at': self.created_at.isoformat()
        }

class MenuItem(db.Model):
    __tablename__ = 'menu_items'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    category = db.Column(db.String(50), nullable=False)  # Coffee, Specialty, Tea, Pastries, Merchandise
    price = db.Column(db.Numeric(10, 2), nullable=False)
    price_small = db.Column(db.Numeric(10, 2), nullable=True)
    price_medium = db.Column(db.Numeric(10, 2), nullable=True)
    price_large = db.Column(db.Numeric(10, 2), nullable=True)
    is_available = db.Column(db.Boolean, default=True)
    image_url = db.Column(db.String(255), nullable=True)
    offered_sizes = db.Column(db.Text, nullable=True)  # JSON list, e.g. ["Small","Medium","Large"]
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    order_items = db.relationship('OrderItem', back_populates='menu_item', cascade='all, delete-orphan')
    ingredients = db.relationship('MenuItemIngredient', backref='menu_item', lazy=True, cascade="all, delete-orphan")

    def price_for_size(self, size=None):
        if size == 'Small' and self.price_small is not None:
            return float(self.price_small)
        if size == 'Medium' and self.price_medium is not None:
            return float(self.price_medium)
        if size == 'Large' and self.price_large is not None:
            return float(self.price_large)
        return float(self.price)

    def to_dict(self):
        offered = offered_sizes_for(self)
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'price': float(self.price),
            'price_small': float(self.price_small) if self.price_small is not None else None,
            'price_medium': float(self.price_medium) if self.price_medium is not None else None,
            'price_large': float(self.price_large) if self.price_large is not None else None,
            'is_available': self.is_available,
            'image_url': self.image_url,
            'created_at': self.created_at.isoformat(),
            'offered_sizes': offered,
            'supports_sizes': bool(offered),
            'ingredients': [
                {
                    'ingredient_id': mi.ingredient_id,
                    'name': mi.ingredient.name,
                    'unit': mi.ingredient.unit,
                    'default_quantity': mi.default_quantity,
                    'qty_small': mi.qty_small,
                    'qty_medium': mi.qty_medium,
                    'qty_large': mi.qty_large,
                    'is_customizable': mi.is_customizable
                } for mi in self.ingredients
            ]
        }

class MenuItemIngredient(db.Model):
    __tablename__ = 'menu_item_ingredients'
    menu_item_id = db.Column(db.Integer, db.ForeignKey('menu_items.id', ondelete='CASCADE'), primary_key=True)
    ingredient_id = db.Column(db.Integer, db.ForeignKey('ingredients.id', ondelete='CASCADE'), primary_key=True)
    default_quantity = db.Column(db.Float, nullable=False, default=0.0)
    qty_small = db.Column(db.Float, nullable=True)
    qty_medium = db.Column(db.Float, nullable=True)
    qty_large = db.Column(db.Float, nullable=True)
    is_customizable = db.Column(db.Boolean, default=False, nullable=False)

    # Relationships
    ingredient = db.relationship('Ingredient')

class IngredientRequest(db.Model):
    __tablename__ = 'ingredient_requests'
    id = db.Column(db.Integer, primary_key=True)
    ingredient_id = db.Column(db.Integer, db.ForeignKey('ingredients.id'), nullable=False)
    staff_name = db.Column(db.String(100), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='pending')  # pending, approved, rejected
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.String(255), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'ingredient_id': self.ingredient_id,
            'ingredient_name': self.ingredient.name if self.ingredient else None,
            'ingredient_unit': self.ingredient.unit if self.ingredient else '',
            'staff_name': self.staff_name,
            'quantity': self.quantity,
            'status': self.status,
            'requested_at': self.requested_at.isoformat(),
            'notes': self.notes
        }

class StockInLog(db.Model):
    __tablename__ = 'stock_in_logs'
    id = db.Column(db.Integer, primary_key=True)
    ingredient_id = db.Column(db.Integer, db.ForeignKey('ingredients.id'), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    cost = db.Column(db.Numeric(10, 2), nullable=False)
    supplier = db.Column(db.String(100), nullable=False)
    invoice_number = db.Column(db.String(100), nullable=True)
    received_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'ingredient_id': self.ingredient_id,
            'ingredient_name': self.ingredient.name if self.ingredient else None,
            'ingredient_unit': self.ingredient.unit if self.ingredient else '',
            'quantity': self.quantity,
            'cost': float(self.cost),
            'supplier': self.supplier,
            'invoice_number': self.invoice_number,
            'received_at': self.received_at.isoformat()
        }

class Order(db.Model):
    __tablename__ = 'orders'
    id = db.Column(db.Integer, primary_key=True)
    status = db.Column(db.String(50), default='completed')  # pending, completed, cancelled
    total_amount = db.Column(db.Numeric(10, 2), default=0.00)
    customer_name = db.Column(db.String(100), nullable=True)
    table_label = db.Column(db.String(20), nullable=True)
    dining = db.Column(db.String(20), nullable=True)  # dine_in, takeaway
    channel = db.Column(db.String(20), nullable=True)  # qr, counter
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'status': self.status,
            'total_amount': float(self.total_amount),
            'customer_name': self.customer_name,
            'table_label': self.table_label,
            'dining': self.dining,
            'channel': self.channel,
            'created_at': self.created_at.isoformat(),
            'items': [item.to_dict() for item in self.items]
        }

class OrderItem(db.Model):
    __tablename__ = 'order_items'
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    menu_item_id = db.Column(db.Integer, db.ForeignKey('menu_items.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    price_at_order = db.Column(db.Numeric(10, 2), nullable=False)
    customizations = db.Column(db.Text, nullable=True)
    size = db.Column(db.String(20), nullable=True)  # Small/Medium/Large

    # Relationships
    menu_item = db.relationship('MenuItem', back_populates='order_items')

    def to_dict(self):
        import json
        customs = []
        if self.customizations:
            try:
                customs = json.loads(self.customizations)
            except Exception:
                customs = []
        return {
            'id': self.id,
            'order_id': self.order_id,
            'menu_item_id': self.menu_item_id,
            'menu_item_name': self.menu_item.name if self.menu_item else None,
            'quantity': self.quantity,
            'price_at_order': float(self.price_at_order),
            'subtotal': float(self.price_at_order * self.quantity),
            'size': self.size,
            'customizations': customs
        }

class Transaction(db.Model):
    __tablename__ = 'transactions'
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=True)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_method = db.Column(db.String(50), nullable=False)  # cash, card, mobile
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'total_amount': float(self.total_amount),
            'payment_method': self.payment_method,
            'created_at': self.created_at.isoformat()
        }

class Review(db.Model):
    __tablename__ = 'reviews'
    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(100), nullable=True)  # free-text blurb under the name, e.g. "Regular since 2021"
    rating = db.Column(db.Integer, nullable=False, default=5)  # 1-5
    comment = db.Column(db.Text, nullable=False)
    is_published = db.Column(db.Boolean, default=False)  # customer submissions wait for an admin
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'customer_name': self.customer_name,
            'role': self.role,
            'rating': self.rating,
            'comment': self.comment,
            'is_published': self.is_published,
            'order_id': self.order_id,
            'created_at': self.created_at.isoformat()
        }

class Subscriber(db.Model):
    __tablename__ = 'subscribers'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'created_at': self.created_at.isoformat()
        }
