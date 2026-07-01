import { useState, useEffect, useCallback } from 'react';
import { 
  Coffee, 
  ShoppingBag, 
  Search, 
  Heart, 
  Plus, 
  Minus, 
  X, 
  Check, 
  Clock, 
  AlertCircle,
  Star,
  Sparkles,
  CupSoda,
  Leaf,
  Cookie
} from 'lucide-react';
import './index.css';

const API_URL = 'http://localhost:5000/api';

// High-quality image mapping for seeded products to match the premium design
const PRODUCT_IMAGES: Record<number, string> = {
  1: 'https://images.unsplash.com/photo-1510707577719-ee7c213a593d?w=600&auto=format&fit=crop&q=80', // Double Espresso
  2: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?w=600&auto=format&fit=crop&q=80', // Americano
  3: 'https://images.unsplash.com/photo-1570968915860-54d5c301fc9f?w=600&auto=format&fit=crop&q=80', // Classic Latte
  4: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80', // Cappuccino
  5: 'https://images.unsplash.com/photo-1598908313733-05db67ae682f?w=600&auto=format&fit=crop&q=80', // Vanilla Latte
  6: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=600&auto=format&fit=crop&q=80', // Salted Caramel Macchiato
  7: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80', // Matcha Latte
  8: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80', // Cold Brew
  9: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80', // Butter Croissant
  10: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=600&auto=format&fit=crop&q=80' // Chocolate Pastry
};

// Default fallback image for newly added items
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80';

interface CartItem {
  id: string; // unique cart item id (due to customizations)
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  customizations: {
    milk: string;
    sugar: string;
    ice: string;
  };
}

function App() {
  // Navigation & UI States
  const [activeView, setActiveView] = useState<'home' | 'menu' | 'tracker'>('home');
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Data States
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [favorites, setFavorites] = useState<number[]>([]);
  
  // Cart & Ordering States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [customQty, setCustomQty] = useState<number>(1);
  const [customMilk, setCustomMilk] = useState<string>('Whole Milk');
  const [customSugar, setCustomSugar] = useState<string>('Regular');
  const [customIce, setCustomIce] = useState<string>('Regular');

  // Checkout Form States
  const [customerName, setCustomerName] = useState<string>('');
  const [dineOption, setDineOption] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'e_wallet'>('cash');

  // Active Order Tracker States
  const [activeOrderId, setActiveOrderId] = useState<number | null>(() => {
    const saved = localStorage.getItem('bb_active_order_id');
    return saved ? parseInt(saved, 10) : null;
  });
  const [trackedOrder, setTrackedOrder] = useState<any | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch Menu Items
  const fetchMenu = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/menu`);
      if (res.ok) {
        const data = await res.json();
        setMenuItems(data.filter((item: any) => item.is_available));
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching menu items:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Poll Active Order Status
  const fetchActiveOrderStatus = useCallback(async () => {
    if (!activeOrderId) return;
    try {
      const res = await fetch(`${API_URL}/orders/${activeOrderId}`);
      if (res.ok) {
        const data = await res.json();
        setTrackedOrder(data);
      } else if (res.status === 404) {
        // Order deleted or invalid
        setActiveOrderId(null);
        localStorage.removeItem('bb_active_order_id');
        setTrackedOrder(null);
      }
    } catch (err) {
      console.error('Error fetching order status:', err);
    }
  }, [activeOrderId]);

  useEffect(() => {
    if (activeOrderId) {
      fetchActiveOrderStatus();
      const interval = setInterval(fetchActiveOrderStatus, 3000); // poll every 3 seconds
      return () => clearInterval(interval);
    } else {
      setTrackedOrder(null);
    }
  }, [activeOrderId, fetchActiveOrderStatus]);

  // Periodic menu sync every 10 seconds silently
  useEffect(() => {
    const timer = setInterval(() => {
      fetchMenu();
    }, 10000);
    return () => clearInterval(timer);
  }, [fetchMenu]);

  // Handle Favorites Toggle
  const toggleFavorite = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
    showToast(favorites.includes(id) ? 'Removed from favorites' : 'Added to favorites');
  };

  // Handle Add to Cart Click (Opens Modal)
  const openCustomizationModal = (product: any) => {
    setSelectedProduct(product);
    setCustomQty(1);
    setCustomMilk('Whole Milk');
    setCustomSugar('Regular');
    setCustomIce('Regular');
  };

  // Calculate customized price
  const getCustomizedPrice = () => {
    if (!selectedProduct) return 0;
    let price = selectedProduct.price;
    if (customMilk === 'Oat Milk' || customMilk === 'Soy Milk') {
      price += 0.50; // extra charge for premium milk
    }
    return price * customQty;
  };

  // Add Item to Cart
  const handleAddToCart = () => {
    if (!selectedProduct) return;
    
    const cartItemId = `${selectedProduct.id}-${customMilk}-${customSugar}-${customIce}`;
    const itemPrice = selectedProduct.price + (customMilk === 'Oat Milk' || customMilk === 'Soy Milk' ? 0.50 : 0);
    
    const existingIndex = cart.findIndex(item => item.id === cartItemId);
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += customQty;
      setCart(updatedCart);
    } else {
      const newCartItem: CartItem = {
        id: cartItemId,
        menuItemId: selectedProduct.id,
        name: selectedProduct.name,
        price: itemPrice,
        quantity: customQty,
        customizations: {
          milk: customMilk,
          sugar: customSugar,
          ice: customIce
        }
      };
      setCart([...cart, newCartItem]);
    }

    setSelectedProduct(null);
    showToast(`${selectedProduct.name} added to cart!`);
  };

  // Cart Operations
  const updateCartQty = (id: string, delta: number) => {
    const updated = cart.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    });
    setCart(updated);
  };

  const removeCartItem = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
    showToast('Item removed from cart');
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Submit Order
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!customerName.trim()) {
      showToast('Please enter your name', 'error');
      return;
    }
    if (dineOption === 'dine_in' && !tableNumber.trim()) {
      showToast('Please enter your table number', 'error');
      return;
    }

    try {
      const orderData = {
        items: cart.map(item => ({
          menu_item_id: item.menuItemId,
          quantity: item.quantity
        })),
        status: 'pending',
        payment_method: paymentMethod,
        // Since backend order table has no custom metadata columns, we pass name/table in the client state tracker
      };

      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (res.ok) {
        const data = await res.json();
        setActiveOrderId(data.id);
        localStorage.setItem('bb_active_order_id', data.id.toString());
        setCart([]);
        setCartOpen(false);
        setActiveView('tracker');
        showToast('Order placed successfully!');
      } else {
        showToast('Failed to place order. Try again.', 'error');
      }
    } catch (err) {
      showToast('Network error placing order', 'error');
    }
  };

  // Categories list
  const categories = [
    { name: 'All', icon: Sparkles },
    { name: 'Coffee', icon: Coffee },
    { name: 'Specialty', icon: CupSoda },
    { name: 'Tea', icon: Leaf },
    { name: 'Pastries', icon: Cookie }
  ];

  // Filtered Menu Items
  const filteredMenuItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER NAVBAR */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logoGroup} onClick={() => setActiveView('home')}>
            <img src="/break_and_brews.png" alt="Logo" style={styles.logo} />
            <span style={styles.logoText}>BREAK & BREWS</span>
          </div>

          <nav style={styles.navLinks}>
            <button 
              onClick={() => setActiveView('home')} 
              style={{...styles.navLink, ...(activeView === 'home' ? styles.navLinkActive : {})}}
            >
              HOME
            </button>
            <button 
              onClick={() => { setActiveView('menu'); setSelectedCategory('All'); fetchMenu(); }} 
              style={{...styles.navLink, ...(activeView === 'menu' ? styles.navLinkActive : {})}}
            >
              ORDER MENU
            </button>
            {activeOrderId && (
              <button 
                onClick={() => setActiveView('tracker')} 
                style={{...styles.navLink, ...(activeView === 'tracker' ? styles.navLinkActive : {})}}
              >
                LIVE TRACKER
              </button>
            )}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => setCartOpen(true)} style={styles.cartTrigger}>
              <ShoppingBag size={22} />
              {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* VIEWS CONTAINER */}
      <main style={{ flex: 1, paddingTop: '80px' }}>
        
        {/* VIEW 1: HOME LANDING PAGE */}
        {activeView === 'home' && (
          <div>
            {/* HERO SECTION */}
            <section style={styles.hero}>
              <div style={styles.heroOverlay}></div>
              <div style={styles.heroContent}>
                <div style={styles.heroTextContainer}>
                  <span style={styles.heroSub}>WELCOME</span>
                  <h1 style={styles.heroTitle}>We serve the richest coffee in the city!</h1>
                  <p style={styles.heroDesc}>"Take a break. Enjoy your brew."</p>
                  <div style={styles.heroBtnGroup}>
                    <button 
                      onClick={() => { setActiveView('menu'); setSelectedCategory('All'); fetchMenu(); }} 
                      className="btn btn-white"
                    >
                      Order Now
                    </button>
                    <button 
                      onClick={() => { setActiveView('menu'); setSelectedCategory('All'); fetchMenu(); }} 
                      className="btn btn-outline-white"
                    >
                      Our Menu
                    </button>
                  </div>
                </div>

                <div style={styles.heroImageContainer}>
                  <div style={styles.coffeeCupIllustration}>
                    <img 
                      src="/break_and_brews.png" 
                      alt="Brand Cup" 
                      style={styles.heroCupLogo} 
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* CATEGORIES PREVIEW */}
            <section style={styles.sectionContainer}>
              <h2 style={styles.sectionTitle}>OUR SPECIAL COFFEE</h2>
              <p style={styles.sectionSubtitle}>Handcrafted premium beverages made with fresh local ingredients</p>
              
              <div style={styles.homeGrid}>
                {menuItems.slice(0, 4).map(item => (
                  <div 
                    key={item.id} 
                    className="glass-card" 
                    style={styles.menuCard}
                    onClick={() => openCustomizationModal(item)}
                  >
                    <div style={styles.cardImageContainer}>
                      <img 
                        src={PRODUCT_IMAGES[item.id] || DEFAULT_IMAGE} 
                        alt={item.name} 
                        style={styles.cardImage} 
                      />
                      <button 
                        onClick={(e) => toggleFavorite(item.id, e)} 
                        style={styles.favBtn}
                      >
                        <Heart 
                          size={18} 
                          fill={favorites.includes(item.id) ? 'var(--danger)' : 'none'} 
                          color={favorites.includes(item.id) ? 'var(--danger)' : '#ffffff'} 
                        />
                      </button>
                    </div>
                    <div style={styles.cardInfo}>
                      <h3 style={styles.cardTitle}>{item.name}</h3>
                      <p style={styles.cardDesc}>Freshly brewed coffee with signature rich aromas.</p>
                      <div style={styles.cardFooter}>
                        <span style={styles.cardPrice}>Rs. {parseInt((item.price * 50).toString())}</span>
                        <button className="btn btn-primary" style={styles.cardAddBtn}>
                          Order
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* BANNER SECTION */}
            <section style={styles.midBanner}>
              <div style={styles.midBannerContent}>
                <h2 style={styles.bannerTitle}>Check Out Our Best Coffee</h2>
                <button 
                  onClick={() => { setActiveView('menu'); setSelectedCategory('All'); fetchMenu(); }} 
                  className="btn btn-white" 
                  style={{ marginTop: '16px' }}
                >
                  Explore Products
                </button>
              </div>
            </section>

            {/* REVIEWS SECTION */}
            <section style={styles.sectionContainer}>
              <h2 style={styles.sectionTitle}>Come and Join OUR HAPPY CUSTOMERS</h2>
              <p style={styles.sectionSubtitle}>What coffee enthusiasts are saying about us</p>

              <div style={styles.reviewGrid}>
                {[
                  { name: 'ALPHM SMITH', rating: 4, review: 'The classic latte is so rich and velvety. The ambiance is wonderful, and the staff portal is incredibly fast!' },
                  { name: 'JESSICA COLLINS', rating: 5, review: 'Absolutely love their Salted Caramel Macchiato. Ordering from my table took seconds. Highly recommended!' },
                  { name: 'ALPHM SMITH', rating: 4, review: 'Best cold brew in the city. The service is prompt and the coffee taste is extremely consistent.' }
                ].map((rev, i) => (
                  <div key={i} className="glass-card" style={styles.reviewCard}>
                    <div style={styles.reviewHeader}>
                      <div>
                        <h4 style={styles.reviewName}>{rev.name}</h4>
                        <span style={styles.reviewRole}>Coffee Enthusiast</span>
                      </div>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[...Array(5)].map((_, idx) => (
                          <Star 
                            key={idx} 
                            size={14} 
                            fill={idx < rev.rating ? '#f59e0b' : 'none'} 
                            color={idx < rev.rating ? '#f59e0b' : '#d1d5db'} 
                          />
                        ))}
                      </div>
                    </div>
                    <p style={styles.reviewText}>"{rev.review}"</p>
                  </div>
                ))}
              </div>
            </section>

            {/* NEWSLETTER BANNER */}
            <section style={styles.newsletterSection}>
              <h2 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Join in and get 15% off!
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                Subscribe to our newsletter for exclusive discounts and product launches.
              </p>
              <div style={styles.subscribeForm}>
                <input 
                  type="email" 
                  placeholder="Enter your email address" 
                  style={styles.subscribeInput} 
                />
                <button className="btn btn-primary" style={styles.subscribeBtn}>
                  Subscribe
                </button>
              </div>
            </section>
          </div>
        )}

        {/* VIEW 2: MENU PAGE */}
        {activeView === 'menu' && (
          <div style={styles.sectionContainer}>
            <div style={styles.menuHeader}>
              <div>
                <h1 style={styles.menuPageTitle}>ORDER MENU</h1>
                <p style={styles.menuPageSubtitle}>Freshly brewed on-demand, customized to your taste.</p>
              </div>

              {/* Search Bar */}
              <div style={styles.searchContainer}>
                <Search size={18} color="var(--text-muted)" />
                <input 
                  type="text" 
                  placeholder="Search coffee or pastries..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={styles.searchInput}
                />
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="category-container">
              {categories.map(cat => {
                const Icon = cat.icon;
                const isActive = selectedCategory.toLowerCase() === cat.name.toLowerCase();
                return (
                  <button 
                    key={cat.name} 
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`category-tab ${isActive ? 'active' : ''}`}
                  >
                    <div className="category-icon-wrapper">
                      <Icon size={18} />
                    </div>
                    <span>{cat.name.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>

            {/* Loading State */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <Clock className="animate-spin" size={32} color="var(--accent-primary)" />
                <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Loading menu items...</p>
              </div>
            ) : filteredMenuItems.length === 0 ? (
              <div style={styles.emptyState}>
                <AlertCircle size={36} color="var(--text-muted)" />
                <p style={{ marginTop: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>No items found</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Try adjusting your filters or search query.</p>
              </div>
            ) : (
              <div style={styles.productGrid}>
                {filteredMenuItems.map(item => (
                  <div 
                    key={item.id} 
                    className="glass-card" 
                    style={styles.menuCard}
                    onClick={() => openCustomizationModal(item)}
                  >
                    <div style={styles.cardImageContainer}>
                      <img 
                        src={PRODUCT_IMAGES[item.id] || DEFAULT_IMAGE} 
                        alt={item.name} 
                        style={styles.cardImage} 
                      />
                      <button 
                        onClick={(e) => toggleFavorite(item.id, e)} 
                        style={styles.favBtn}
                      >
                        <Heart 
                          size={18} 
                          fill={favorites.includes(item.id) ? 'var(--danger)' : 'none'} 
                          color={favorites.includes(item.id) ? 'var(--danger)' : '#ffffff'} 
                        />
                      </button>
                    </div>
                    <div style={styles.cardInfo}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={styles.cardCategory}>{item.category}</span>
                        <span style={styles.cardPrice}>Rs. {parseInt((item.price * 50).toString())}</span>
                      </div>
                      <h3 style={styles.cardTitle}>{item.name}</h3>
                      <p style={styles.cardDesc}>Customizable drink prepared by our expert baristas.</p>
                      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}>
                        <Plus size={16} />
                        Add to Order
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: LIVE ORDER TRACKER */}
        {activeView === 'tracker' && (
          <div style={{ ...styles.sectionContainer, maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={styles.trackerTitle}>LIVE ORDER STATUS</h1>
            
            {trackedOrder ? (
              <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={styles.trackerHeader}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>Order #{trackedOrder.id}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Placed at {new Date(trackedOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span style={{
                    ...styles.statusBadge,
                    backgroundColor: 
                      trackedOrder.status === 'completed' ? 'var(--success-bg)' :
                      trackedOrder.status === 'preparing' ? 'var(--warning-bg)' : 'var(--accent-light)',
                    color: 
                      trackedOrder.status === 'completed' ? 'var(--success)' :
                      trackedOrder.status === 'preparing' ? 'var(--warning)' : 'var(--accent-primary)',
                  }}>
                    {trackedOrder.status.toUpperCase()}
                  </span>
                </div>

                {/* Progress Visual Tracker */}
                <div style={styles.timelineContainer}>
                  <div style={styles.timelineLine}>
                    <div style={{
                      ...styles.timelineProgress,
                      width: 
                        trackedOrder.status === 'completed' ? '100%' :
                        trackedOrder.status === 'preparing' ? '50%' : '0%'
                    }}></div>
                  </div>
                  
                  <div style={styles.timelineSteps}>
                    <div style={{ ...styles.timelineStep, opacity: 1 }}>
                      <div style={{ ...styles.stepCircle, backgroundColor: 'var(--accent-primary)', color: '#fff' }}>
                        <Check size={16} />
                      </div>
                      <span style={styles.stepLabel}>Received</span>
                    </div>

                    <div style={{ 
                      ...styles.timelineStep, 
                      opacity: trackedOrder.status === 'preparing' || trackedOrder.status === 'completed' ? 1 : 0.5 
                    }}>
                      <div style={{ 
                        ...styles.stepCircle, 
                        backgroundColor: trackedOrder.status === 'preparing' || trackedOrder.status === 'completed' ? 'var(--accent-primary)' : 'var(--bg-primary)',
                        color: trackedOrder.status === 'preparing' || trackedOrder.status === 'completed' ? '#fff' : 'var(--text-muted)' 
                      }}>
                        {trackedOrder.status === 'completed' ? <Check size={16} /> : <Clock size={16} />}
                      </div>
                      <span style={styles.stepLabel}>Preparing</span>
                    </div>

                    <div style={{ 
                      ...styles.timelineStep, 
                      opacity: trackedOrder.status === 'completed' ? 1 : 0.5 
                    }}>
                      <div style={{ 
                        ...styles.stepCircle, 
                        backgroundColor: trackedOrder.status === 'completed' ? 'var(--success)' : 'var(--bg-primary)',
                        color: trackedOrder.status === 'completed' ? '#fff' : 'var(--text-muted)' 
                      }}>
                        <Check size={16} />
                      </div>
                      <span style={styles.stepLabel}>Ready!</span>
                    </div>
                  </div>
                </div>

                {/* Celebration Message */}
                {trackedOrder.status === 'completed' && (
                  <div style={styles.readyBanner}>
                    <Sparkles size={24} />
                    <div>
                      <h4 style={{ margin: 0, fontWeight: '700' }}>Your order is ready!</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>Please collect it from the counter. Enjoy your brew!</p>
                    </div>
                  </div>
                )}

                {/* Items Summary */}
                <div style={styles.orderSummaryBox}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Items Ordered
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {trackedOrder.items.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-primary)' }}>
                            {item.menu_item_name}
                          </p>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Qty: {item.quantity}
                          </span>
                        </div>
                        <span style={{ fontWeight: '600' }}>
                          Rs. {parseInt((item.price_at_order * 50 * item.quantity).toString())}
                        </span>
                      </div>
                    ))}
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-glass)', margin: '16px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '1.1rem' }}>
                    <span>Total Amount</span>
                    <span>Rs. {parseInt((trackedOrder.total_amount * 50).toString())}</span>
                  </div>
                </div>

                {/* Button to start a new order */}
                {trackedOrder.status === 'completed' && (
                  <button 
                    onClick={() => {
                      setActiveOrderId(null);
                      localStorage.removeItem('bb_active_order_id');
                      setActiveView('menu');
                      fetchMenu();
                    }}
                    className="btn btn-primary"
                    style={{ justifyContent: 'center' }}
                  >
                    Order Something Else
                  </button>
                )}
              </div>
            ) : (
              <div style={styles.emptyState}>
                <Clock size={36} color="var(--text-muted)" />
                <p style={{ marginTop: '12px', fontWeight: '600' }}>No active order found</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Place an order from the menu to track it here in real-time.</p>
              </div>
            )}
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer style={styles.footer}>
        <div style={styles.footerGrid}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={styles.logoGroup}>
              <img src="/break_and_brews.png" alt="Logo" style={styles.logo} />
              <span style={{ ...styles.logoText, color: '#fff' }}>BREAK & BREWS</span>
            </div>
            <p style={{ color: 'var(--text-light-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
              We serve the richest coffee in the city! Take a break. Enjoy your brew.
            </p>
          </div>

          <div>
            <h4 style={styles.footerHeader}>PRIVACY</h4>
            <div style={styles.footerLinks}>
              <a href="#" style={styles.footerLink}>Terms of Use</a>
              <a href="#" style={styles.footerLink}>Privacy Policy</a>
              <a href="#" style={styles.footerLink}>Cookies</a>
            </div>
          </div>

          <div>
            <h4 style={styles.footerHeader}>SERVICES</h4>
            <div style={styles.footerLinks}>
              <a href="#" style={styles.footerLink}>Shop</a>
              <a href="#" style={styles.footerLink}>Order Online</a>
              <a href="#" style={styles.footerLink}>Menu</a>
            </div>
          </div>

          <div>
            <h4 style={styles.footerHeader}>ABOUT US</h4>
            <div style={styles.footerLinks}>
              <a href="#" style={styles.footerLink}>Our Story</a>
              <a href="#" style={styles.footerLink}>Baristas</a>
              <a href="#" style={styles.footerLink}>Contact Us</a>
            </div>
          </div>
        </div>
        <div style={styles.footerBottom}>
          <p>&copy; {new Date().getFullYear()} Break & Brews Coffee Shop. All rights reserved.</p>
        </div>
      </footer>

      {/* CUSTOMIZATION MODAL */}
      {selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ position: 'relative' }}>
              <img 
                src={PRODUCT_IMAGES[selectedProduct.id] || DEFAULT_IMAGE} 
                alt={selectedProduct.name} 
                style={styles.modalHeroImage} 
              />
              <button 
                onClick={() => setSelectedProduct(null)} 
                style={styles.modalCloseBtn}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>{selectedProduct.name}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                  {selectedProduct.category} | Rs. {parseInt((selectedProduct.price * 50).toString())}
                </p>
              </div>

              {/* Customizations options (only for drinks) */}
              {selectedProduct.category !== 'Pastries' && selectedProduct.category !== 'Merchandise' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Milk Option */}
                  <div style={styles.optionGroup}>
                    <label style={styles.optionLabel}>Milk Type</label>
                    <div style={styles.optionRow}>
                      {['Whole Milk', 'Oat Milk (+$25)', 'Soy Milk (+$25)'].map(m => {
                        const mVal = m.split(' ')[0] + ' Milk';
                        const isSel = customMilk === mVal;
                        return (
                          <button 
                            key={m} 
                            onClick={() => setCustomMilk(mVal)}
                            style={{...styles.optionSelector, ...(isSel ? styles.optionSelectorActive : {})}}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sugar Option */}
                  <div style={styles.optionGroup}>
                    <label style={styles.optionLabel}>Sugar Level</label>
                    <div style={styles.optionRow}>
                      {['No Sugar', 'Less Sugar', 'Regular', 'Extra'].map(s => {
                        const isSel = customSugar === s;
                        return (
                          <button 
                            key={s} 
                            onClick={() => setCustomSugar(s)}
                            style={{...styles.optionSelector, ...(isSel ? styles.optionSelectorActive : {})}}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ice Option */}
                  <div style={styles.optionGroup}>
                    <label style={styles.optionLabel}>Ice Level</label>
                    <div style={styles.optionRow}>
                      {['No Ice', 'Less Ice', 'Regular', 'Extra Ice'].map(i => {
                        const isSel = customIce === i;
                        return (
                          <button 
                            key={i} 
                            onClick={() => setCustomIce(i)}
                            style={{...styles.optionSelector, ...(isSel ? styles.optionSelectorActive : {})}}
                          >
                            {i}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Quantity Select */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={styles.optionLabel}>Quantity</span>
                <div style={styles.qtyControl}>
                  <button onClick={() => setCustomQty(q => Math.max(1, q - 1))} style={styles.qtyBtn}>
                    <Minus size={16} />
                  </button>
                  <span style={styles.qtyValue}>{customQty}</span>
                  <button onClick={() => setCustomQty(q => q + 1)} style={styles.qtyBtn}>
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Add Button */}
              <button 
                onClick={handleAddToCart}
                className="btn btn-primary" 
                style={{ width: '100%', justifyContent: 'center', padding: '16px' }}
              >
                Add to Cart - Rs. {parseInt((getCustomizedPrice() * 50).toString())}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING CART TRIGGER */}
      {cart.length > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)} className="floating-cart-btn">
          <ShoppingBag size={24} />
          <span className="cart-badge">{cart.length}</span>
        </button>
      )}

      {/* CART SIDEBAR SLIDEOUT */}
      {cartOpen && (
        <>
          <div onClick={() => setCartOpen(false)} className="cart-sidebar-overlay"></div>
          <div className="cart-sidebar">
            <div style={styles.cartHeader}>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>Your Cart</h3>
              <button onClick={() => setCartOpen(false)} style={styles.closeCartBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.cartBody}>
              {cart.length === 0 ? (
                <div style={{ ...styles.emptyState, flex: 1, justifyContent: 'center' }}>
                  <ShoppingBag size={36} color="var(--text-muted)" />
                  <p style={{ marginTop: '12px', fontWeight: '600' }}>Your cart is empty</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Browse the menu and add items.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {cart.map(item => (
                    <div key={item.id} style={styles.cartItem}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                          {item.name}
                        </h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                          {item.customizations.milk} | {item.customizations.sugar} | {item.customizations.ice}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={styles.qtyControlSmall}>
                          <button onClick={() => updateCartQty(item.id, -1)} style={styles.qtyBtnSmall}>
                            <Minus size={12} />
                          </button>
                          <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{item.quantity}</span>
                          <button onClick={() => updateCartQty(item.id, 1)} style={styles.qtyBtnSmall}>
                            <Plus size={12} />
                          </button>
                        </div>
                        <span style={{ fontWeight: '700', minWidth: '60px', textAlign: 'right' }}>
                          Rs. {parseInt((item.price * 50 * item.quantity).toString())}
                        </span>
                        <button onClick={() => removeCartItem(item.id)} style={{ color: 'var(--text-muted)' }}>
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkout Form */}
            {cart.length > 0 && (
              <form onSubmit={handleCheckout} style={styles.checkoutForm}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Customer Name */}
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Your Name</label>
                    <input 
                      type="text" 
                      placeholder="E.g. John Doe"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      style={styles.formInput}
                      required
                    />
                  </div>

                  {/* Dine-in vs Takeaway */}
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Dining Option</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button"
                        onClick={() => setDineOption('dine_in')}
                        style={{
                          ...styles.optionSelector, 
                          flex: 1, 
                          justifyContent: 'center',
                          ...(dineOption === 'dine_in' ? styles.optionSelectorActive : {})
                        }}
                      >
                        Dine In
                      </button>
                      <button 
                        type="button"
                        onClick={() => setDineOption('takeaway')}
                        style={{
                          ...styles.optionSelector, 
                          flex: 1, 
                          justifyContent: 'center',
                          ...(dineOption === 'takeaway' ? styles.optionSelectorActive : {})
                        }}
                      >
                        Takeaway
                      </button>
                    </div>
                  </div>

                  {/* Table Number (only if Dine-in) */}
                  {dineOption === 'dine_in' && (
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Table Number</label>
                      <input 
                        type="text" 
                        placeholder="E.g. Table 5"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        style={styles.formInput}
                        required
                      />
                    </div>
                  )}

                  {/* Payment Method */}
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Payment Method</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        style={{
                          ...styles.optionSelector, 
                          flex: 1, 
                          justifyContent: 'center',
                          ...(paymentMethod === 'cash' ? styles.optionSelectorActive : {})
                        }}
                      >
                        Cash
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        style={{
                          ...styles.optionSelector, 
                          flex: 1, 
                          justifyContent: 'center',
                          ...(paymentMethod === 'card' ? styles.optionSelectorActive : {})
                        }}
                      >
                        Card
                      </button>
                    </div>
                  </div>
                </div>

                <div style={styles.cartFooter}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '1.25rem' }}>
                    <span>Total Amount</span>
                    <span>Rs. {parseInt((getCartTotal() * 50).toString())}</span>
                  </div>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '16px', marginTop: '16px' }}
                  >
                    Place Order
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}

      {/* Global Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: toast.type === 'error' ? 'var(--danger)' : 'var(--text-primary)',
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: '30px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          zIndex: 3000,
          fontWeight: '600',
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  header: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    height: '80px',
    backgroundColor: 'rgba(245, 239, 230, 0.8)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--border-glass)',
    zIndex: 900
  },
  headerContent: {
    maxWidth: '1200px',
    height: '100%',
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  logoGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer'
  },
  logo: {
    width: '40px',
    height: '40px',
    borderRadius: '10px'
  },
  logoText: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '1px'
  },
  navLinks: {
    display: 'flex',
    gap: '32px'
  },
  navLink: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    letterSpacing: '1px'
  },
  navLinkActive: {
    color: 'var(--accent-primary)',
    borderBottom: '2px solid var(--accent-primary)',
    paddingBottom: '4px'
  },
  cartTrigger: {
    position: 'relative' as const,
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-light)',
    color: 'var(--accent-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  // Hero Section
  hero: {
    position: 'relative' as const,
    backgroundColor: 'var(--bg-dark)',
    color: '#ffffff',
    padding: '80px 24px',
    overflow: 'hidden'
  },
  heroOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(148, 118, 86, 0.15) 0%, transparent 60%)',
    pointerEvents: 'none' as const
  },
  heroContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '48px',
    alignItems: 'center',
    position: 'relative' as const,
    zIndex: 2
  },
  heroTextContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start'
  },
  heroSub: {
    fontSize: '0.85rem',
    fontWeight: '700',
    letterSpacing: '4px',
    color: 'var(--accent-primary)',
    marginBottom: '16px'
  },
  heroTitle: {
    fontSize: '3.5rem',
    lineHeight: '1.15',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '16px'
  },
  heroDesc: {
    fontSize: '1.5rem',
    fontStyle: 'italic',
    color: 'var(--text-light-muted)',
    marginBottom: '32px'
  },
  heroBtnGroup: {
    display: 'flex',
    gap: '16px'
  },
  heroImageContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  coffeeCupIllustration: {
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
  },
  heroCupLogo: {
    width: '200px',
    height: '200px',
    objectFit: 'contain' as const
  },

  // Menu Page & Cards
  sectionContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '60px 24px'
  },
  sectionTitle: {
    fontSize: '2rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    textAlign: 'center' as const,
    marginBottom: '8px'
  },
  sectionSubtitle: {
    fontSize: '1rem',
    color: 'var(--text-muted)',
    textAlign: 'center' as const,
    marginBottom: '48px'
  },
  homeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '32px'
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '32px',
    marginTop: '24px'
  },
  menuCard: {
    overflow: 'hidden',
    cursor: 'pointer'
  },
  cardImageContainer: {
    height: '200px',
    position: 'relative' as const,
    overflow: 'hidden'
  },
  cardImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    transition: 'var(--transition-smooth)'
  },
  favBtn: {
    position: 'absolute' as const,
    top: 16,
    right: 16,
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'rgba(18, 15, 14, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardInfo: {
    padding: '20px'
  },
  cardCategory: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--accent-primary)',
    textTransform: 'uppercase' as const
  },
  cardTitle: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '8px 0'
  },
  cardDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: '1.5',
    margin: 0
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '20px'
  },
  cardPrice: {
    fontSize: '1.15rem',
    fontWeight: '800',
    color: 'var(--text-primary)'
  },
  cardAddBtn: {
    padding: '8px 16px',
    fontSize: '0.85rem'
  },

  // Mid Banner
  midBanner: {
    backgroundImage: 'linear-gradient(rgba(18, 15, 14, 0.7), rgba(18, 15, 14, 0.7)), url("https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&auto=format&fit=crop&q=80")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    padding: '100px 24px',
    textAlign: 'center' as const,
    color: '#ffffff'
  },
  midBannerContent: {
    maxWidth: '1200px',
    margin: '0 auto'
  },
  bannerTitle: {
    fontSize: '2.5rem',
    fontWeight: '800',
    marginBottom: '12px'
  },

  // Reviews Section
  reviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '32px'
  },
  reviewCard: {
    padding: '28px'
  },
  reviewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  reviewName: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0
  },
  reviewRole: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  reviewText: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    lineHeight: '1.6',
    fontStyle: 'italic',
    margin: 0
  },

  // Newsletter Section
  newsletterSection: {
    backgroundColor: '#e8dfd3',
    padding: '60px 24px',
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center'
  },
  subscribeForm: {
    display: 'flex',
    width: '100%',
    maxWidth: '480px',
    gap: '8px'
  },
  subscribeInput: {
    flex: 1,
    padding: '14px 20px',
    borderRadius: '30px',
    border: '1px solid var(--border-glass)',
    backgroundColor: '#ffffff',
    fontSize: '0.95rem'
  },
  subscribeBtn: {
    padding: '0 28px'
  },

  // Menu Page Specific Layout
  menuHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '24px',
    marginBottom: '32px'
  },
  menuPageTitle: {
    fontSize: '2.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)'
  },
  menuPageSubtitle: {
    fontSize: '0.95rem',
    color: 'var(--text-muted)',
    marginTop: '4px'
  },
  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'var(--card-bg)',
    border: '1.5px solid var(--border-glass)',
    borderRadius: '30px',
    padding: '8px 20px',
    width: '320px',
    maxWidth: '100%'
  },
  searchInput: {
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
    width: '100%'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '80px 24px',
    textAlign: 'center' as const
  },

  // Live Tracker
  trackerTitle: {
    fontSize: '2rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    textAlign: 'center' as const,
    marginBottom: '32px'
  },
  trackerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '20px',
    borderBottom: '1px solid var(--border-glass)'
  },
  statusBadge: {
    fontSize: '0.75rem',
    fontWeight: '800',
    padding: '6px 12px',
    borderRadius: '20px'
  },
  timelineContainer: {
    position: 'relative' as const,
    margin: '20px 0'
  },
  timelineLine: {
    position: 'absolute' as const,
    top: '20px',
    left: '10%',
    right: '10%',
    height: '4px',
    backgroundColor: 'var(--bg-primary)',
    zIndex: 1
  },
  timelineProgress: {
    height: '100%',
    backgroundColor: 'var(--accent-primary)',
    transition: 'width 0.5s ease'
  },
  timelineSteps: {
    display: 'flex',
    justifyContent: 'space-between',
    position: 'relative' as const,
    zIndex: 2
  },
  timelineStep: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
    width: '80px'
  },
  stepCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    border: '3px solid #ffffff',
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
    transition: 'var(--transition-smooth)'
  },
  stepLabel: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  readyBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: 'var(--success-bg)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    color: 'var(--success)',
    padding: '16px 20px',
    borderRadius: '16px'
  },
  orderSummaryBox: {
    backgroundColor: 'var(--bg-primary)',
    padding: '24px',
    borderRadius: '18px',
    border: '1px solid var(--border-glass)'
  },

  // Customization Modal
  modalHeroImage: {
    width: '100%',
    height: '240px',
    objectFit: 'cover' as const
  },
  modalCloseBtn: {
    position: 'absolute' as const,
    top: 16,
    right: 16,
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: 'rgba(18, 15, 14, 0.6)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  optionGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  optionLabel: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textTransform: 'uppercase' as const
  },
  optionRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px'
  },
  optionSelector: {
    padding: '10px 16px',
    borderRadius: '20px',
    border: '1.5px solid var(--border-glass)',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    backgroundColor: 'transparent'
  },
  optionSelectorActive: {
    borderColor: 'var(--accent-primary)',
    backgroundColor: 'var(--accent-light)',
    color: 'var(--accent-primary)'
  },
  qtyControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: 'var(--bg-primary)',
    padding: '4px',
    borderRadius: '30px',
    border: '1px solid var(--border-glass)'
  },
  qtyBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-primary)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
  },
  qtyValue: {
    fontSize: '1rem',
    fontWeight: '700',
    minWidth: '24px',
    textAlign: 'center' as const
  },

  // Cart Slideout
  closeCartBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)'
  },
  cartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px',
    borderBottom: '1px solid var(--border-glass)'
  },
  cartBody: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '24px'
  },
  cartItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--bg-primary)'
  },
  qtyControlSmall: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-primary)',
    padding: '2px',
    borderRadius: '20px'
  },
  qtyBtnSmall: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-primary)'
  },
  checkoutForm: {
    padding: '24px',
    borderTop: '1px solid var(--border-glass)',
    backgroundColor: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px'
  },
  formLabel: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textTransform: 'uppercase' as const
  },
  formInput: {
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1.5px solid var(--border-glass)',
    backgroundColor: '#ffffff',
    fontSize: '0.9rem',
    color: 'var(--text-primary)'
  },
  cartFooter: {
    marginTop: '8px'
  },

  // Footer
  footer: {
    backgroundColor: 'var(--bg-dark)',
    color: '#ffffff',
    padding: '60px 24px 24px 24px',
    marginTop: 'auto'
  },
  footerGrid: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1.5fr repeat(3, 1fr)',
    gap: '48px',
    paddingBottom: '40px',
    borderBottom: '1px solid var(--border-dark)',
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr'
    }
  },
  footerHeader: {
    fontSize: '0.85rem',
    fontWeight: '800',
    letterSpacing: '2px',
    color: 'var(--accent-primary)',
    marginBottom: '20px'
  },
  footerLinks: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px'
  },
  footerLink: {
    fontSize: '0.9rem',
    color: 'var(--text-light-muted)',
    textDecoration: 'none',
    transition: 'var(--transition-smooth)'
  },
  footerBottom: {
    maxWidth: '1200px',
    margin: '0 auto',
    paddingTop: '24px',
    textAlign: 'center' as const,
    fontSize: '0.85rem',
    color: 'var(--text-light-muted)'
  }
};

export default App;
