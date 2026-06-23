import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from decimal import Decimal
from datetime import datetime, timedelta
from config import Config
from models import db, Staff, Ingredient, MenuItem, IngredientRequest, StockInLog, Order, OrderItem, Transaction

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for frontend requests
CORS(app)

# Initialize database
db.init_app(app)

# Helper function to convert Decimals to floats recursively for JSON response
def clean_decimal(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: clean_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_decimal(i) for i in obj]
    return obj

# ----------------- INGREDIENTS ENDPOINTS -----------------

@app.route('/api/ingredients', methods=['GET', 'POST'])
def manage_ingredients():
    if request.method == 'POST':
        data = request.json or {}
        if not data or 'name' not in data or 'category' not in data or 'unit' not in data:
            return jsonify({'error': 'Missing name, category, or unit'}), 400
        
        # Check duplicate
        if Ingredient.query.filter_by(name=data['name']).first():
            return jsonify({'error': 'Ingredient name already exists'}), 400

        ing = Ingredient(
            name=data['name'],
            category=data['category'],
            stock_level=float(data.get('stock_level', 0.0)),
            unit=data['unit'],
            reorder_point=float(data.get('reorder_point', 5.0)),
            cost_per_unit=Decimal(str(data.get('cost_per_unit', 0.00)))
        )
        db.session.add(ing)
        db.session.commit()
        return jsonify(clean_decimal(ing.to_dict())), 201

    # GET ingredients
    ingredients = Ingredient.query.order_by(Ingredient.category, Ingredient.name).all()
    return jsonify(clean_decimal([i.to_dict() for i in ingredients]))

@app.route('/api/ingredients/<int:id>', methods=['PUT', 'DELETE'])
def update_ingredient(id):
    ing = Ingredient.query.get_or_400(id)
    if request.method == 'DELETE':
        db.session.delete(ing)
        db.session.commit()
        return jsonify({'message': 'Ingredient deleted successfully'})
    
    # PUT update
    data = request.json or {}
    if 'name' in data and data['name'] != ing.name:
        if Ingredient.query.filter_by(name=data['name']).first():
            return jsonify({'error': 'Ingredient name already exists'}), 400
        ing.name = data['name']
        
    if 'category' in data:
        ing.category = data['category']
    if 'stock_level' in data:
        ing.stock_level = float(data['stock_level'])
    if 'unit' in data:
        ing.unit = data['unit']
    if 'reorder_point' in data:
        ing.reorder_point = float(data['reorder_point'])
    if 'cost_per_unit' in data:
        ing.cost_per_unit = Decimal(str(data['cost_per_unit']))
        
    db.session.commit()
    return jsonify(clean_decimal(ing.to_dict()))

# ----------------- MENU ENDPOINTS -----------------

@app.route('/api/menu', methods=['GET', 'POST'])
def manage_menu():
    if request.method == 'POST':
        data = request.json or {}
        if not data or 'name' not in data or 'price' not in data or 'category' not in data:
            return jsonify({'error': 'Missing name, price or category'}), 400
        
        # Check duplicate
        if MenuItem.query.filter_by(name=data['name']).first():
            return jsonify({'error': 'Menu item name already exists'}), 400

        item = MenuItem(
            name=data['name'],
            category=data['category'],
            price=Decimal(str(data['price'])),
            is_available=data.get('is_available', True),
            image_url=data.get('image_url')
        )
        db.session.add(item)
        db.session.commit()
        return jsonify(clean_decimal(item.to_dict())), 201

    # GET menu
    items = MenuItem.query.order_by(MenuItem.category, MenuItem.name).all()
    return jsonify(clean_decimal([i.to_dict() for i in items]))

@app.route('/api/menu/<int:id>', methods=['PUT', 'DELETE'])
def update_menu_item(id):
    item = MenuItem.query.get_or_400(id)
    if request.method == 'DELETE':
        db.session.delete(item)
        db.session.commit()
        return jsonify({'message': 'Menu item deleted successfully'})
    
    # PUT update
    data = request.json or {}
    if 'name' in data and data['name'] != item.name:
        if MenuItem.query.filter_by(name=data['name']).first():
            return jsonify({'error': 'Menu item name already exists'}), 400
        item.name = data['name']
        
    if 'category' in data:
        item.category = data['category']
    if 'price' in data:
        item.price = Decimal(str(data['price']))
    if 'is_available' in data:
        item.is_available = data['is_available']
    if 'image_url' in data:
        item.image_url = data['image_url']
        
    db.session.commit()
    return jsonify(clean_decimal(item.to_dict()))

# ----------------- INGREDIENT REQUESTS (MANAGE REQUEST) -----------------

@app.route('/api/requests', methods=['GET', 'POST'])
def manage_requests():
    if request.method == 'POST':
        data = request.json or {}
        if not data or 'ingredient_id' not in data or 'staff_name' not in data or 'quantity' not in data:
            return jsonify({'error': 'Missing ingredient_id, staff_name or quantity'}), 400
        
        req_qty = float(data['quantity'])
        if req_qty <= 0:
            return jsonify({'error': 'Quantity must be greater than zero'}), 400

        # Check ingredient exists
        ing = Ingredient.query.get(data['ingredient_id'])
        if not ing:
            return jsonify({'error': 'Ingredient not found'}), 404

        req = IngredientRequest(
            ingredient_id=data['ingredient_id'],
            staff_name=data['staff_name'],
            quantity=req_qty,
            status='pending',
            notes=data.get('notes')
        )
        db.session.add(req)
        db.session.commit()
        return jsonify(clean_decimal(req.to_dict())), 201

    # GET requests
    reqs = IngredientRequest.query.order_by(IngredientRequest.requested_at.desc()).all()
    return jsonify(clean_decimal([r.to_dict() for r in reqs]))

@app.route('/api/requests/<int:id>', methods=['PUT', 'DELETE'])
def update_request(id):
    req = IngredientRequest.query.get_or_400(id)
    
    if request.method == 'DELETE':
        db.session.delete(req)
        db.session.commit()
        return jsonify({'message': 'Request deleted successfully'})

    data = request.json or {}
    new_status = data.get('status')
    if new_status not in ['pending', 'approved', 'rejected']:
        return jsonify({'error': 'Invalid status'}), 400

    # Auto-stock management on approval transition
    if new_status == 'approved' and req.status != 'approved':
        # Check stock sufficiency
        if req.ingredient.stock_level < req.quantity:
            return jsonify({'error': f'Insufficient stock level in inventory. Current stock: {req.ingredient.stock_level} {req.ingredient.unit}'}), 400
        # Deduct ingredient stock
        req.ingredient.stock_level -= req.quantity
    elif req.status == 'approved' and new_status != 'approved':
        # Revert approved quantity if changed back
        req.ingredient.stock_level += req.quantity

    req.status = new_status
    if 'notes' in data:
        req.notes = data['notes']

    db.session.commit()
    return jsonify(clean_decimal(req.to_dict()))

# ----------------- RECORD STOCK IN -----------------

@app.route('/api/stockin', methods=['GET', 'POST'])
def manage_stockin():
    if request.method == 'POST':
        data = request.json or {}
        if not data or 'ingredient_id' not in data or 'quantity' not in data or 'cost' not in data or 'supplier' not in data:
            return jsonify({'error': 'Missing ingredient_id, quantity, cost or supplier'}), 400
        
        qty = float(data['quantity'])
        cost = Decimal(str(data['cost']))
        if qty <= 0:
            return jsonify({'error': 'Quantity must be greater than zero'}), 400
        if cost <= 0:
            return jsonify({'error': 'Cost must be greater than zero'}), 400

        # Check ingredient exists
        ing = Ingredient.query.get(data['ingredient_id'])
        if not ing:
            return jsonify({'error': 'Ingredient not found'}), 404

        # Add quantity to ingredient stock
        ing.stock_level += qty
        
        # Optionally update cost per unit
        ing.cost_per_unit = Decimal(round(float(cost / Decimal(str(qty))), 2))

        stock_log = StockInLog(
            ingredient_id=data['ingredient_id'],
            quantity=qty,
            cost=cost,
            supplier=data['supplier'],
            invoice_number=data.get('invoice_number'),
            received_at=datetime.utcnow()
        )
        db.session.add(stock_log)
        db.session.commit()
        return jsonify(clean_decimal(stock_log.to_dict())), 201

    # GET stock-in logs
    logs = StockInLog.query.order_by(StockInLog.received_at.desc()).all()
    return jsonify(clean_decimal([l.to_dict() for l in logs]))

# ----------------- STAFF ROSTER ENDPOINTS -----------------

@app.route('/api/staff', methods=['GET', 'POST'])
def manage_staff():
    if request.method == 'POST':
        data = request.json or {}
        if not data or 'name' not in data:
            return jsonify({'error': 'Missing staff name'}), 400

        new_s = Staff(
            name=data['name'],
            role=data.get('role', 'staff'),
            email=data.get('email'),
            phone=data.get('phone'),
            is_active=data.get('is_active', True)
        )
        db.session.add(new_s)
        db.session.commit()
        return jsonify(clean_decimal(new_s.to_dict())), 201

    staff_members = Staff.query.order_by(Staff.name).all()
    return jsonify(clean_decimal([s.to_dict() for s in staff_members]))

# ----------------- COFFEE SALES POS ENDPOINTS (SIMULATED COFFEE PURCHASES) -----------------

@app.route('/api/orders', methods=['POST'])
def place_order():
    data = request.json or {}
    items_data = data.get('items', [])
    if not items_data:
        return jsonify({'error': 'No items ordered'}), 400

    total_amount = Decimal('0.00')
    order_items = []
    
    for item in items_data:
        menu_item_id = item.get('menu_item_id')
        qty = item.get('quantity', 1)
        menu_item = MenuItem.query.get(menu_item_id)
        if not menu_item or not menu_item.is_available:
            return jsonify({'error': f'Item ID {menu_item_id} is unavailable'}), 400
        
        price_snapshot = menu_item.price
        total_amount += price_snapshot * qty
        
        order_items.append(OrderItem(
            menu_item_id=menu_item_id,
            quantity=qty,
            price_at_order=price_snapshot
        ))

    new_order = Order(
        status='completed',
        total_amount=total_amount,
        items=order_items
    )
    db.session.add(new_order)
    db.session.commit()

    txn = Transaction(
        order_id=new_order.id,
        total_amount=total_amount,
        payment_method=data.get('payment_method', 'cash')
    )
    db.session.add(txn)
    db.session.commit()

    return jsonify(clean_decimal(new_order.to_dict())), 201

# ----------------- ANALYTICS & REPORTS ENDPOINTS -----------------

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    thirty_days_ago = today_start - timedelta(days=30)
    
    # 1. KPIs
    total_ingredients = Ingredient.query.count()
    
    # Low stock ingredients (stock_level <= reorder_point)
    low_stock_count = Ingredient.query.filter(Ingredient.stock_level <= Ingredient.reorder_point).count()
    
    # Pending ingredient requests
    pending_requests = IngredientRequest.query.filter_by(status='pending').count()
    
    # Total value of recorded stock in the last 30 days
    recent_stock_ins = StockInLog.query.filter(StockInLog.received_at >= thirty_days_ago).all()
    total_stock_in_value = sum(float(log.cost) for log in recent_stock_ins)

    # 2. Charts Data
    # 7-day revenue trend
    revenue_trend = []
    for d in range(6, -1, -1):
        target_day = today_start - timedelta(days=d)
        end_day = target_day + timedelta(days=1)
        day_txns = Transaction.query.filter(Transaction.created_at >= target_day, Transaction.created_at < end_day).all()
        day_revenue = sum(float(t.total_amount) for t in day_txns)
        revenue_trend.append({
            'date': target_day.strftime('%b %d'),
            'revenue': round(day_revenue, 2)
        })

    # Ingredient stock levels distribution (top 5 categories)
    category_distribution = []
    categories = db.session.query(Ingredient.category).distinct().all()
    for cat in categories:
        cat_name = cat[0]
        count = Ingredient.query.filter_by(category=cat_name).count()
        category_distribution.append({
            'name': cat_name,
            'value': count
        })

    # Recent Pending Requests list
    recent_requests = IngredientRequest.query.filter_by(status='pending').order_by(IngredientRequest.requested_at.desc()).limit(5).all()
    recent_requests_list = [r.to_dict() for r in recent_requests]

    # Low Stock Details list
    low_stock_items = Ingredient.query.filter(Ingredient.stock_level <= Ingredient.reorder_point).order_by(Ingredient.stock_level).limit(5).all()
    low_stock_list = [i.to_dict() for i in low_stock_items]

    return jsonify(clean_decimal({
        'kpi': {
            'total_ingredients': total_ingredients,
            'low_stock_count': low_stock_count,
            'pending_requests': pending_requests,
            'total_stock_in_value': round(total_stock_in_value, 2)
        },
        'revenue_trend': revenue_trend,
        'category_distribution': category_distribution,
        'recent_requests': recent_requests_list,
        'low_stock_items': low_stock_list
    }))

@app.route('/api/reports', methods=['GET'])
def get_reports():
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    
    # 1. Ingredient Inventory Health Report
    ingredients = Ingredient.query.order_by(Ingredient.stock_level.asc()).all()
    inventory_health = []
    for ing in ingredients:
        status = 'Normal'
        if ing.stock_level == 0:
            status = 'Out of Stock'
        elif ing.stock_level <= ing.reorder_point:
            status = 'Low Stock'
        
        inventory_health.append({
            'id': ing.id,
            'name': ing.name,
            'category': ing.category,
            'stock_level': ing.stock_level,
            'unit': ing.unit,
            'reorder_point': ing.reorder_point,
            'cost_value': round(ing.stock_level * float(ing.cost_per_unit), 2),
            'status': status
        })

    # 2. Stock In Summary by Supplier
    supplier_summary = []
    suppliers = db.session.query(StockInLog.supplier).distinct().all()
    for sup in suppliers:
        sup_name = sup[0]
        logs = StockInLog.query.filter_by(supplier=sup_name).all()
        total_cost = sum(float(l.cost) for l in logs)
        total_items = sum(l.quantity for l in logs)
        supplier_summary.append({
            'supplier': sup_name,
            'total_spent': round(total_cost, 2),
            'shipments_count': len(logs)
        })

    # 3. Monthly Menu Sales Volume
    sales_breakdown = []
    order_items = OrderItem.query.all()
    item_sales = {}
    for oi in order_items:
        if oi.menu_item:
            name = oi.menu_item.name
            item_sales[name] = item_sales.get(name, 0.0) + float(oi.price_at_order * oi.quantity)
            
    for name, revenue in item_sales.items():
        sales_breakdown.append({
            'menu_item': name,
            'revenue': round(revenue, 2)
        })
    # Sort by revenue descending
    sales_breakdown.sort(key=lambda x: x['revenue'], reverse=True)

    return jsonify(clean_decimal({
        'inventory_health': inventory_health,
        'supplier_summary': supplier_summary,
        'sales_breakdown': sales_breakdown
    }))

# ----------------- DB SETUP & RUN -----------------

if __name__ == '__main__':
    with app.app_context():
        # Setup tables & seed automatically
        from seed import seed_database
        seed_database()
        
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
