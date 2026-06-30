import random
from datetime import datetime, timedelta
from decimal import Decimal
from models import db, Staff, Ingredient, MenuItem, IngredientRequest, StockInLog, Order, OrderItem, Transaction

def seed_database():
    # Drop all tables and recreate them to ensure a fresh schema reset
    print("Dropping all existing tables...")
    db.drop_all()
    print("Creating all tables from new schema...")
    db.create_all()

    print("Seeding database with coffee shop inventory data...")

    # 1. Seed Staff
    staff_admin = Staff(name="Admin User", role="admin", email="admin@breakandbrews.com", phone="+1 (555) 000-0000", is_active=True)
    staff_admin.set_password("password123")

    staff1 = Staff(name="Marcus Aurelius", role="admin", email="marcus@breakandbrews.com", phone="+1 (555) 019-2831", is_active=True)
    staff1.set_password("password123")
    
    staff2 = Staff(name="John Doe", role="staff", email="john@breakandbrews.com", phone="+1 (555) 014-9988", is_active=True)
    staff2.set_password("password123")
    
    staff3 = Staff(name="Jane Smith", role="staff", email="jane@breakandbrews.com", phone="+1 (555) 012-7744", is_active=True)
    staff3.set_password("password123")
    
    staff4 = Staff(name="Robert Plan", role="staff", email="robert@breakandbrews.com", phone="+1 (555) 011-2233", is_active=False)
    staff4.set_password("password123")
    
    db.session.add_all([staff_admin, staff1, staff2, staff3, staff4])
    db.session.commit()

    # 2. Seed Ingredients
    ingredients = [
        Ingredient(name="Espresso Roast Beans", category="Coffee Beans", stock_level=22.5, unit="kg", reorder_point=8.0, cost_per_unit=Decimal('18.50')),
        Ingredient(name="Whole Milk", category="Dairy", stock_level=32.0, unit="L", reorder_point=12.0, cost_per_unit=Decimal('2.20')),
        Ingredient(name="Oat Milk", category="Dairy", stock_level=8.0, unit="L", reorder_point=5.0, cost_per_unit=Decimal('3.50')),
        Ingredient(name="White Sugar", category="Sweeteners", stock_level=12.0, unit="kg", reorder_point=4.0, cost_per_unit=Decimal('2.80')),
        Ingredient(name="Vanilla Syrup", category="Syrups", stock_level=4.5, unit="L", reorder_point=2.0, cost_per_unit=Decimal('8.50')),
        Ingredient(name="Caramel Sauce", category="Syrups", stock_level=1.5, unit="L", reorder_point=2.0, cost_per_unit=Decimal('10.00')), # Low stock alert
        Ingredient(name="12oz To-Go Cups", category="Packaging", stock_level=450.0, unit="pcs", reorder_point=150.0, cost_per_unit=Decimal('0.15')),
        Ingredient(name="Paper Straws", category="Packaging", stock_level=80.0, unit="pcs", reorder_point=100.0, cost_per_unit=Decimal('0.04')), # Low stock alert
        Ingredient(name="Butter Croissants (Frozen)", category="Pastries", stock_level=35.0, unit="pcs", reorder_point=10.0, cost_per_unit=Decimal('1.80')),
        Ingredient(name="Chocolate Croissants (Frozen)", category="Pastries", stock_level=12.0, unit="pcs", reorder_point=8.0, cost_per_unit=Decimal('2.10'))
    ]
    db.session.add_all(ingredients)
    db.session.commit()

    # 3. Seed Coffee Shop Menu Items
    menu_items = [
        MenuItem(name="Double Espresso", category="Coffee", price=Decimal('3.20'), is_available=True, image_url="/assets/espresso.jpg"),
        MenuItem(name="Caffè Americano", category="Coffee", price=Decimal('3.50'), is_available=True, image_url="/assets/americano.jpg"),
        MenuItem(name="Classic Latte", category="Coffee", price=Decimal('4.50'), is_available=True, image_url="/assets/latte.jpg"),
        MenuItem(name="Cappuccino", category="Coffee", price=Decimal('4.50'), is_available=True, image_url="/assets/cappuccino.jpg"),
        MenuItem(name="Vanilla Latte", category="Specialty", price=Decimal('5.20'), is_available=True, image_url="/assets/vanilla_latte.jpg"),
        MenuItem(name="Salted Caramel Macchiato", category="Specialty", price=Decimal('5.50'), is_available=True, image_url="/assets/macchiato.jpg"),
        MenuItem(name="Matcha Latte", category="Specialty", price=Decimal('5.00'), is_available=True, image_url="/assets/matcha.jpg"),
        MenuItem(name="Cold Brew", category="Coffee", price=Decimal('4.20'), is_available=True, image_url="/assets/cold_brew.jpg"),
        MenuItem(name="Butter Croissant", category="Pastries", price=Decimal('3.80'), is_available=True, image_url="/assets/croissant.jpg"),
        MenuItem(name="Chocolate Pastry", category="Pastries", price=Decimal('4.20'), is_available=True, image_url="/assets/choc_croissant.jpg")
    ]
    db.session.add_all(menu_items)
    db.session.commit()

    # 4. Seed Ingredient Requests (Manage Request)
    requests_data = [
        IngredientRequest(ingredient_id=1, staff_name="John Doe", quantity=5.0, status="approved", requested_at=datetime.utcnow() - timedelta(days=2), notes="For main bar espresso hopper"),
        IngredientRequest(ingredient_id=2, staff_name="Jane Smith", quantity=12.0, status="approved", requested_at=datetime.utcnow() - timedelta(days=1), notes="Weekend dairy restocking"),
        IngredientRequest(ingredient_id=3, staff_name="John Doe", quantity=4.0, status="pending", requested_at=datetime.utcnow() - timedelta(hours=4), notes="Oat milk running low at coffee bar 2"),
        IngredientRequest(ingredient_id=6, staff_name="Jane Smith", quantity=2.0, status="pending", requested_at=datetime.utcnow() - timedelta(hours=2), notes="Urgent! We are out of caramel drizzle sauce"),
        IngredientRequest(ingredient_id=8, staff_name="John Doe", quantity=200.0, status="rejected", requested_at=datetime.utcnow() - timedelta(days=3), notes="Weekly stock check found error in request form")
    ]
    db.session.add_all(requests_data)
    db.session.commit()

    # 5. Seed Stock In Logs (Record Stock In)
    now = datetime.utcnow()
    stock_ins = [
        StockInLog(ingredient_id=1, quantity=20.0, cost=Decimal('370.00'), supplier="Columbia Coffee Importers", invoice_number="INV-2026-001", received_at=now - timedelta(days=6)),
        StockInLog(ingredient_id=2, quantity=40.0, cost=Decimal('88.00'), supplier="Valley View Farms", invoice_number="INV-5541A", received_at=now - timedelta(days=5)),
        StockInLog(ingredient_id=7, quantity=500.0, cost=Decimal('75.00'), supplier="EcoPack Distributors", invoice_number="INV-9988", received_at=now - timedelta(days=4)),
        StockInLog(ingredient_id=4, quantity=10.0, cost=Decimal('28.00'), supplier="Global Grocery Corp", invoice_number="INV-2019", received_at=now - timedelta(days=3)),
        StockInLog(ingredient_id=9, quantity=50.0, cost=Decimal('90.00'), supplier="Le Gourmet Bakery", invoice_number="LGB-8871", received_at=now - timedelta(days=1))
    ]
    db.session.add_all(stock_ins)
    db.session.commit()

    # 6. Seed Historical Sales Orders & Transactions (for reports)
    payment_methods = ["cash", "card", "mobile"]
    
    for d in range(1, 15):  # Past 14 days of sales
        day = now - timedelta(days=d)
        
        # 10 to 25 transactions per day
        num_sales = random.randint(10, 25)
        for _ in range(num_sales):
            # Order time between 8 AM and 7 PM
            order_time = day.replace(hour=random.randint(8, 18), minute=random.randint(0, 59), second=random.randint(0, 59))
            
            # Select random menu items
            items_ordered = random.sample(menu_items, k=random.randint(1, 3))
            total_amount = Decimal('0.00')
            order_items = []
            
            for menu_item in items_ordered:
                qty = random.randint(1, 3)
                price = menu_item.price
                total_amount += price * qty
                
                order_items.append(OrderItem(
                    menu_item_id=menu_item.id,
                    quantity=qty,
                    price_at_order=price
                ))
            
            order = Order(
                status="completed",
                total_amount=total_amount,
                created_at=order_time,
                items=order_items
            )
            db.session.add(order)
            db.session.commit()
            
            txn = Transaction(
                order_id=order.id,
                total_amount=total_amount,
                payment_method=random.choice(payment_methods),
                created_at=order_time
            )
            db.session.add(txn)

    db.session.commit()
    print("Database seeding completed successfully!")
