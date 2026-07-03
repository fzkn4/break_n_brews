import random
from datetime import datetime, timedelta
from decimal import Decimal
from models import db, Staff, Ingredient, MenuItem, MenuItemIngredient, IngredientRequest, StockInLog, Order, OrderItem, Transaction

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

    staff_user = Staff(name="Staff User", role="staff", email="staff@breakandbrews.com", phone="+1 (555) 111-1111", is_active=True)
    staff_user.set_password("password123")

    staff1 = Staff(name="Marcus Aurelius", role="admin", email="marcus@breakandbrews.com", phone="+1 (555) 019-2831", is_active=True)
    staff1.set_password("password123")
    
    staff2 = Staff(name="John Doe", role="staff", email="john@breakandbrews.com", phone="+1 (555) 014-9988", is_active=True)
    staff2.set_password("password123")
    
    staff3 = Staff(name="Jane Smith", role="staff", email="jane@breakandbrews.com", phone="+1 (555) 012-7744", is_active=True)
    staff3.set_password("password123")
    
    staff4 = Staff(name="Robert Plan", role="staff", email="robert@breakandbrews.com", phone="+1 (555) 011-2233", is_active=False)
    staff4.set_password("password123")
    
    db.session.add_all([staff_admin, staff_user, staff1, staff2, staff3, staff4])
    db.session.commit()

    # 2. Seed Ingredients
    ing_map = {
        "beans": Ingredient(name="Espresso Roast Beans", category="Coffee Beans", stock_level=22.5, unit="kg", reorder_point=8.0, cost_per_unit=Decimal('18.50')),
        "milk": Ingredient(name="Whole Milk", category="Dairy", stock_level=32.0, unit="L", reorder_point=12.0, cost_per_unit=Decimal('2.20')),
        "oatmilk": Ingredient(name="Oat Milk", category="Dairy", stock_level=18.0, unit="L", reorder_point=5.0, cost_per_unit=Decimal('3.50')),
        "sugar": Ingredient(name="White Sugar", category="Sweeteners", stock_level=12.0, unit="kg", reorder_point=4.0, cost_per_unit=Decimal('2.80')),
        "vanilla": Ingredient(name="Vanilla Syrup", category="Syrups", stock_level=4.5, unit="L", reorder_point=2.0, cost_per_unit=Decimal('8.50')),
        "caramel": Ingredient(name="Caramel Sauce", category="Syrups", stock_level=3.5, unit="L", reorder_point=2.0, cost_per_unit=Decimal('10.00')),
        "cups": Ingredient(name="12oz To-Go Cups", category="Packaging", stock_level=450.0, unit="pcs", reorder_point=150.0, cost_per_unit=Decimal('0.15')),
        "straws": Ingredient(name="Paper Straws", category="Packaging", stock_level=180.0, unit="pcs", reorder_point=100.0, cost_per_unit=Decimal('0.04')),
        "croissant": Ingredient(name="Butter Croissants (Frozen)", category="Pastries", stock_level=35.0, unit="pcs", reorder_point=10.0, cost_per_unit=Decimal('1.80')),
        "choc_croissant": Ingredient(name="Chocolate Croissants (Frozen)", category="Pastries", stock_level=22.0, unit="pcs", reorder_point=8.0, cost_per_unit=Decimal('2.10')),
        "ice": Ingredient(name="Ice Cubes", category="Sweeteners", stock_level=50.0, unit="kg", reorder_point=10.0, cost_per_unit=Decimal('0.50')),
        "beer": Ingredient(name="Heineken Beer Bottle", category="Beverages", stock_level=48.0, unit="pcs", reorder_point=12.0, cost_per_unit=Decimal('2.50')),
        "wine": Ingredient(name="Red Wine Bottle", category="Beverages", stock_level=12.0, unit="pcs", reorder_point=3.0, cost_per_unit=Decimal('15.00')),
        "rice": Ingredient(name="Jasmine Rice", category="Grains", stock_level=40.0, unit="kg", reorder_point=10.0, cost_per_unit=Decimal('1.80')),
        "beef": Ingredient(name="Beef Tenderloin", category="Meat", stock_level=15.0, unit="kg", reorder_point=5.0, cost_per_unit=Decimal('12.00')),
        "pork": Ingredient(name="Pork Belly", category="Meat", stock_level=15.0, unit="kg", reorder_point=5.0, cost_per_unit=Decimal('9.50')),
        "eggs": Ingredient(name="Fresh Eggs", category="Dairy", stock_level=120.0, unit="pcs", reorder_point=30.0, cost_per_unit=Decimal('0.20')),
        "potatoes": Ingredient(name="Potatoes", category="Pastries", stock_level=25.0, unit="kg", reorder_point=8.0, cost_per_unit=Decimal('1.50')),
        "oil": Ingredient(name="Cooking Oil", category="Dairy", stock_level=20.0, unit="L", reorder_point=5.0, cost_per_unit=Decimal('3.00')),
        "chili": Ingredient(name="Chili Flakes", category="Sweeteners", stock_level=2.0, unit="kg", reorder_point=0.5, cost_per_unit=Decimal('5.00')),
        "soysauce": Ingredient(name="Soy Sauce", category="Syrups", stock_level=5.0, unit="L", reorder_point=1.5, cost_per_unit=Decimal('4.00'))
    }
    
    for ing in ing_map.values():
        db.session.add(ing)
    db.session.commit()

    # 3. Seed Menu Items categorized into 7 categories
    # Categories: Coffee, iced coffee, food and snacks, alcoholic drinks, platter, rice bowl, rice meals
    items_data = [
        # Coffee
        {"name": "Double Espresso", "category": "Coffee", "price": Decimal('3.20'), "image_url": "/assets/espresso.jpg",
         "recipe": [("beans", 0.018, False), ("cups", 1.0, False)]},
        {"name": "Caffè Americano", "category": "Coffee", "price": "3.50", "image_url": "/assets/americano.jpg",
         "recipe": [("beans", 0.018, False), ("cups", 1.0, False)]},
        {"name": "Classic Latte", "category": "Coffee", "price": "4.50", "image_url": "/assets/latte.jpg",
         "recipe": [("beans", 0.018, False), ("milk", 0.20, True), ("sugar", 0.01, True), ("cups", 1.0, False), ("straws", 1.0, False)]},
        {"name": "Vanilla Latte", "category": "Coffee", "price": "5.20", "image_url": "/assets/vanilla_latte.jpg",
         "recipe": [("beans", 0.018, False), ("milk", 0.20, True), ("vanilla", 0.02, True), ("cups", 1.0, False), ("straws", 1.0, False)]},
        {"name": "Cold Brew", "category": "Coffee", "price": "4.20", "image_url": "/assets/cold_brew.jpg",
         "recipe": [("beans", 0.020, False), ("cups", 1.0, False), ("straws", 1.0, False)]},

        # Iced Coffee
        {"name": "Iced Caramel Macchiato", "category": "iced coffee", "price": "5.50", "image_url": "/assets/macchiato.jpg",
         "recipe": [("beans", 0.018, False), ("milk", 0.15, True), ("caramel", 0.02, True), ("ice", 0.1, True), ("cups", 1.0, False), ("straws", 1.0, False)]},
        {"name": "Iced Matcha Latte", "category": "iced coffee", "price": "5.00", "image_url": "/assets/matcha.jpg",
         "recipe": [("oatmilk", 0.20, True), ("ice", 0.1, True), ("cups", 1.0, False), ("straws", 1.0, False)]},

        # Food and snacks
        {"name": "Butter Croissant", "category": "food and snacks", "price": "3.80", "image_url": "/assets/croissant.jpg",
         "recipe": [("croissant", 1.0, False)]},
        {"name": "Chocolate Pastry", "category": "food and snacks", "price": "4.20", "image_url": "/assets/choc_croissant.jpg",
         "recipe": [("choc_croissant", 1.0, False)]},

        # Alcoholic drinks
        {"name": "Cold Beer Heineken", "category": "alcoholic drinks", "price": "4.50", "image_url": "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&auto=format&fit=crop&q=80",
         "recipe": [("beer", 1.0, False)]},
        {"name": "Red Wine Glass", "category": "alcoholic drinks", "price": "6.50", "image_url": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&auto=format&fit=crop&q=80",
         "recipe": [("wine", 0.2, False)]},

        # Platter
        {"name": "French Fries Platter", "category": "platter", "price": "5.50", "image_url": "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=600&auto=format&fit=crop&q=80",
         "recipe": [("potatoes", 0.25, False), ("oil", 0.05, False), ("chili", 0.005, True)]},

        # Rice bowl
        {"name": "Spicy Beef Rice Bowl", "category": "rice bowl", "price": "7.50", "image_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
         "recipe": [("rice", 0.15, False), ("beef", 0.12, False), ("eggs", 1.0, True), ("chili", 0.005, True)]},

        # Rice meals
        {"name": "Pork Belly Rice Meal", "category": "rice meals", "price": "8.00", "image_url": "https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=600&auto=format&fit=crop&q=80",
         "recipe": [("rice", 0.15, False), ("pork", 0.15, False), ("eggs", 1.0, True), ("soysauce", 0.02, True)]}
    ]

    menu_items = []
    for item_info in items_data:
        item = MenuItem(
            name=item_info["name"],
            category=item_info["category"],
            price=Decimal(str(item_info["price"])),
            is_available=True,
            image_url=item_info["image_url"]
        )
        db.session.add(item)
        db.session.flush() # Populate ID

        # Seed Recipe Ingredients
        for ing_key, qty, customizable in item_info["recipe"]:
            ing = ing_map[ing_key]
            recipe_item = MenuItemIngredient(
                menu_item_id=item.id,
                ingredient_id=ing.id,
                default_quantity=qty,
                is_customizable=customizable
            )
            db.session.add(recipe_item)
        
        menu_items.append(item)
    
    db.session.commit()

    # 4. Seed Ingredient Requests (Manage Request)
    requests_data = [
        IngredientRequest(ingredient_id=ing_map["beans"].id, staff_name="John Doe", quantity=5.0, status="approved", requested_at=datetime.utcnow() - timedelta(days=2), notes="For main bar espresso hopper"),
        IngredientRequest(ingredient_id=ing_map["milk"].id, staff_name="Jane Smith", quantity=12.0, status="approved", requested_at=datetime.utcnow() - timedelta(days=1), notes="Weekend dairy restocking"),
        IngredientRequest(ingredient_id=ing_map["oatmilk"].id, staff_name="John Doe", quantity=4.0, status="pending", requested_at=datetime.utcnow() - timedelta(hours=4), notes="Oat milk running low at coffee bar 2"),
        IngredientRequest(ingredient_id=ing_map["caramel"].id, staff_name="Jane Smith", quantity=2.0, status="pending", requested_at=datetime.utcnow() - timedelta(hours=2), notes="Urgent! We are out of caramel drizzle sauce"),
        IngredientRequest(ingredient_id=ing_map["straws"].id, staff_name="John Doe", quantity=200.0, status="rejected", requested_at=datetime.utcnow() - timedelta(days=3), notes="Weekly stock check found error in request form")
    ]
    db.session.add_all(requests_data)
    db.session.commit()

    # 5. Seed Stock In Logs (Record Stock In)
    now = datetime.utcnow()
    stock_ins = [
        StockInLog(ingredient_id=ing_map["beans"].id, quantity=20.0, cost=Decimal('370.00'), supplier="Columbia Coffee Importers", invoice_number="INV-2026-001", received_at=now - timedelta(days=6)),
        StockInLog(ingredient_id=ing_map["milk"].id, quantity=40.0, cost=Decimal('88.00'), supplier="Valley View Farms", invoice_number="INV-5541A", received_at=now - timedelta(days=5)),
        StockInLog(ingredient_id=ing_map["cups"].id, quantity=500.0, cost=Decimal('75.00'), supplier="EcoPack Distributors", invoice_number="INV-9988", received_at=now - timedelta(days=4)),
        StockInLog(ingredient_id=ing_map["sugar"].id, quantity=10.0, cost=Decimal('28.00'), supplier="Global Grocery Corp", invoice_number="INV-2019", received_at=now - timedelta(days=3)),
        StockInLog(ingredient_id=ing_map["croissant"].id, quantity=50.0, cost=Decimal('90.00'), supplier="Le Gourmet Bakery", invoice_number="LGB-8871", received_at=now - timedelta(days=1))
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

                # Deduct ingredients based on recipe
                for recipe_item in menu_item.ingredients:
                    ing = recipe_item.ingredient
                    ing.stock_level = max(0.0, float(ing.stock_level) - (qty * recipe_item.default_quantity))
            
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

    # Reset stock levels back to healthy starting values so that the shop has initial stock
    initial_stocks = {
        "Espresso Roast Beans": 22.5,
        "Whole Milk": 32.0,
        "Oat Milk": 18.0,
        "White Sugar": 12.0,
        "Vanilla Syrup": 4.5,
        "Caramel Sauce": 3.5,
        "12oz To-Go Cups": 450.0,
        "Paper Straws": 180.0,
        "Butter Croissants (Frozen)": 35.0,
        "Chocolate Croissants (Frozen)": 22.0,
        "Ice Cubes": 50.0,
        "Heineken Beer Bottle": 48.0,
        "Red Wine Bottle": 12.0,
        "Jasmine Rice": 40.0,
        "Beef Tenderloin": 15.0,
        "Pork Belly": 15.0,
        "Fresh Eggs": 120.0,
        "Potatoes": 25.0,
        "Cooking Oil": 20.0,
        "Chili Flakes": 2.0,
        "Soy Sauce": 5.0
    }
    for ing in Ingredient.query.all():
        if ing.name in initial_stocks:
            ing.stock_level = initial_stocks[ing.name]

    db.session.commit()
    print("Database seeding completed successfully!")
