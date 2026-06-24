from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Staff(db.Model):
    __tablename__ = 'staff'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), default='staff')  # admin, staff
    email = db.Column(db.String(100), unique=True, nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

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
            'created_at': self.created_at.isoformat()
        }

class MenuItem(db.Model):
    __tablename__ = 'menu_items'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    category = db.Column(db.String(50), nullable=False)  # Coffee, Specialty, Tea, Pastries, Merchandise
    price = db.Column(db.Numeric(10, 2), nullable=False)
    is_available = db.Column(db.Boolean, default=True)
    image_url = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    order_items = db.relationship('OrderItem', back_populates='menu_item', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'price': float(self.price),
            'is_available': self.is_available,
            'image_url': self.image_url,
            'created_at': self.created_at.isoformat()
        }

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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'status': self.status,
            'total_amount': float(self.total_amount),
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

    # Relationships
    menu_item = db.relationship('MenuItem', back_populates='order_items')

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'menu_item_id': self.menu_item_id,
            'menu_item_name': self.menu_item.name if self.menu_item else None,
            'quantity': self.quantity,
            'price_at_order': float(self.price_at_order),
            'subtotal': float(self.price_at_order * self.quantity)
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
