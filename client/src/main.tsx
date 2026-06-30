import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8088/api";

type Category = { id: string; name: string; description?: string };
type Product = {
  id: string;
  code: string;
  name: string;
  description: string;
  category_id: string;
  category_name: string;
  price: number;
  image_url?: string;
  stock: number;
  min_stock: number;
  active: boolean;
  stock_status: "disponible" | "bajo_stock" | "agotado";
};
type User = { id: string; name: string; email: string; role: "admin" | "vendedor" | "cliente"; phone?: string; address?: string };
type CartItem = { product: Product; quantity: number };
type Order = {
  id: string;
  customer_name: string;
  customer_email: string;
  delivery_method: string;
  payment_method: string;
  status: string;
  total: number;
  created_at: string;
  items: { productName: string; quantity: number; subtotal: number }[];
};
type Movement = { id: string; product_name: string; product_code: string; type: string; quantity: number; previous_stock: number; new_stock: number; note?: string; created_at: string };
type Report = { orders: number; revenue: number; products: number; low_stock: number; topProducts: { product_name: string; quantity: number; revenue: number }[] };

const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => JSON.parse(localStorage.getItem("cart") || "[]"));
  const [orders, setOrders] = useState<Order[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [tab, setTab] = useState("catalogo");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");

  const isStaff = user?.role === "admin" || user?.role === "vendedor";
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Error inesperado" }));
      throw new Error(payload.error || "Error inesperado");
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  }

  async function loadPublicData() {
    const [categoryData, productData] = await Promise.all([
      api<Category[]>("/categories"),
      api<Product[]>(`/products?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&includeInactive=${isStaff}`),
    ]);
    setCategories(categoryData);
    setProducts(productData);
  }

  async function loadPrivateData() {
    if (!token) return;
    const orderData = await api<Order[]>("/orders");
    setOrders(orderData);
    if (isStaff) {
      const [movementData, reportData] = await Promise.all([api<Movement[]>("/inventory/movements"), api<Report>("/reports/summary")]);
      setMovements(movementData);
      setReport(reportData);
    }
  }

  useEffect(() => {
    loadPublicData().catch((error) => setMessage(error.message));
  }, [search, category, token, user?.role]);

  useEffect(() => {
    loadPrivateData().catch(() => undefined);
  }, [token, user?.role]);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  function login(nextToken: string, nextUser: User) {
    localStorage.setItem("token", nextToken);
    localStorage.setItem("user", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
    setMessage(`Sesion iniciada como ${nextUser.name}`);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
    setTab("catalogo");
  }

  function addToCart(product: Product) {
    if (product.stock <= 0) return setMessage("Producto agotado");
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } : item);
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  async function placeOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: form.get("customerName"),
          customerEmail: form.get("customerEmail"),
          customerPhone: form.get("customerPhone"),
          deliveryMethod: form.get("deliveryMethod"),
          paymentMethod: form.get("paymentMethod"),
          notes: form.get("notes"),
          items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        }),
      });
      setCart([]);
      setTab("pedidos");
      setMessage("Pedido creado correctamente");
      await loadPublicData();
      await loadPrivateData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el pedido");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--plate-bg)] text-[var(--ink)]">
      <Header user={user} cartCount={cart.length} tab={tab} setTab={setTab} logout={logout} isStaff={isStaff} />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {message && <div className="mb-5 rounded-2xl border border-[var(--sun)]/40 bg-[var(--sun-soft)] px-4 py-3 text-sm font-semibold text-[var(--ink)]">{message}</div>}
        {tab === "catalogo" && <Catalog products={products} categories={categories} search={search} setSearch={setSearch} category={category} setCategory={setCategory} addToCart={addToCart} />}
        {tab === "carrito" && <Cart cart={cart} setCart={setCart} total={cartTotal} user={user} placeOrder={placeOrder} />}
        {tab === "login" && <Auth api={api} login={login} />}
        {tab === "pedidos" && <Orders orders={orders} token={token} isStaff={isStaff} api={api} reload={loadPrivateData} />}
        {tab === "inventario" && isStaff && <Inventory products={products} movements={movements} api={api} reload={async () => { await loadPublicData(); await loadPrivateData(); }} />}
        {tab === "productos" && isStaff && <ProductAdmin products={products} categories={categories} api={api} reload={loadPublicData} />}
        {tab === "reportes" && isStaff && <Reports report={report} />}
      </section>
    </main>
  );
}

function Header({ user, cartCount, tab, setTab, logout, isStaff }: { user: User | null; cartCount: number; tab: string; setTab: (tab: string) => void; logout: () => void; isStaff: boolean }) {
  const nav = ["catalogo", "carrito", ...(user ? ["pedidos"] : ["login"]), ...(isStaff ? ["inventario", "productos", "reportes"] : [])];
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--plate-line)] bg-white/85 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <div className="logo-mark" aria-hidden="true"><span></span></div>
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--aqua)]">Hoy Milanesas</p>
            <h1 className="text-2xl font-black sm:text-3xl">Tienda Online</h1>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2">
          {nav.map((item) => <button className={tab === item ? "nav-active" : "nav"} key={item} onClick={() => setTab(item)}>{item}{item === "carrito" ? ` (${cartCount})` : ""}</button>)}
          {user && <button className="nav" onClick={logout}>salir</button>}
        </nav>
      </div>
    </header>
  );
}

function Catalog({ products, categories, search, setSearch, category, setCategory, addToCart }: { products: Product[]; categories: Category[]; search: string; setSearch: (value: string) => void; category: string; setCategory: (value: string) => void; addToCart: (product: Product) => void }) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  function selectProduct(product: Product) {
    setSelectedProduct(product);
  }

  function handleProductKey(event: React.KeyboardEvent<HTMLElement>, product: Product) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectProduct(product);
    }
  }

  return <div className="space-y-6">
    <section className="hero-card rounded-[2rem] p-8 shadow-2xl shadow-orange-200/50">
      <div className="max-w-3xl space-y-4">
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-widest text-[var(--tomato)] ring-1 ring-[var(--sun)]/40">Venta directa</span>
        <h2 className="text-4xl font-black leading-tight sm:text-6xl">Milanesas listas para hoy</h2>
        <p className="text-lg font-medium text-orange-950/75">Compra milanesas, hamburguesas, cortes y embutidos con stock en tiempo real. El sistema reserva el consumo al confirmar tu pedido.</p>
      </div>
    </section>
    <div className="grid gap-3 md:grid-cols-[1fr_260px]">
      <input className="input" placeholder="Buscar por producto o codigo" value={search} onChange={(event) => setSearch(event.target.value)} />
      <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="">Todas las categorias</option>
        {categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
      </select>
    </div>
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => <article className="card product-card overflow-hidden" key={product.id} role="button" tabIndex={0} onClick={() => selectProduct(product)} onKeyDown={(event) => handleProductKey(event, product)} aria-label={`Ver detalle de ${product.name}`}>
        <img className="h-44 w-full object-cover" src={product.image_url || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80"} alt={product.name} />
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <button className="badge hover:bg-[var(--sun-soft)]" onClick={(event) => { event.stopPropagation(); setCategory(product.category_name); }}>{product.category_name}</button>
            <StockBadge status={product.stock_status} />
          </div>
          <h3 className="text-lg font-bold">{product.name}</h3>
          <p className="min-h-12 text-sm font-medium text-[var(--muted)]">{product.description}</p>
          <p className="text-xs font-black uppercase tracking-widest text-[var(--aqua)]">Ver detalle de compra</p>
          <div className="flex items-end justify-between">
            <div><p className="text-2xl font-black text-[var(--tomato)]">{money.format(product.price)}</p><p className="text-xs font-semibold text-[var(--muted)]">Stock: {product.stock}</p></div>
            <button className="btn" disabled={product.stock <= 0} onClick={(event) => { event.stopPropagation(); addToCart(product); }}>Agregar</button>
          </div>
        </div>
      </article>)}
    </div>
    {selectedProduct && <ProductDetailModal product={selectedProduct} close={() => setSelectedProduct(null)} addToCart={(product) => { addToCart(product); setSelectedProduct(null); }} />}
  </div>;
}

function ProductDetailModal({ product, close, addToCart }: { product: Product; close: () => void; addToCart: (product: Product) => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-orange-950/45 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="product-detail-title" onClick={close}>
    <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-[var(--plate-line)] bg-white shadow-2xl shadow-orange-300/60" onClick={(event) => event.stopPropagation()}>
      <div className="grid md:grid-cols-[1.1fr_0.9fr]">
        <img className="h-72 w-full object-cover md:h-full" src={product.image_url || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80"} alt={product.name} />
        <div className="space-y-5 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <span className="badge">{product.category_name}</span>
              <h2 id="product-detail-title" className="text-3xl font-black text-[var(--ink)]">{product.name}</h2>
            </div>
            <button className="btn-secondary" onClick={close} aria-label="Cerrar detalle">Cerrar</button>
          </div>
          <p className="font-medium text-[var(--muted)]">{product.description}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Codigo" value={product.code} />
            <DetailItem label="Categoria" value={product.category_name} />
            <DetailItem label="Precio unitario" value={money.format(product.price)} highlight />
            <DetailItem label="Stock disponible" value={`${product.stock} unidades`} />
            <DetailItem label="Stock minimo" value={`${product.min_stock} unidades`} />
            <DetailItem label="Estado" value={product.stock_status.replace("_", " ")} />
          </div>
          <div className="rounded-2xl border border-[var(--sun)]/30 bg-[var(--sun-soft)] p-4 text-sm font-semibold text-orange-950/80">
            Estas agregando este producto al carrito. El stock se descuenta solo cuando confirmas el pedido.
          </div>
          <button className="btn w-full" disabled={product.stock <= 0} onClick={() => addToCart(product)}>{product.stock <= 0 ? "Producto agotado" : "Agregar al carrito"}</button>
        </div>
      </div>
    </section>
  </div>;
}

function DetailItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className="rounded-2xl bg-orange-50 p-4 ring-1 ring-orange-100">
    <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">{label}</p>
    <p className={highlight ? "mt-1 text-2xl font-black text-[var(--tomato)]" : "mt-1 font-bold text-[var(--ink)]"}>{value}</p>
  </div>;
}

function Cart({ cart, setCart, total, user, placeOrder }: { cart: CartItem[]; setCart: React.Dispatch<React.SetStateAction<CartItem[]>>; total: number; user: User | null; placeOrder: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
    <section className="card p-5">
      <h2 className="section-title">Carrito</h2>
      {cart.length === 0 ? <p className="text-[var(--muted)]">Tu carrito esta vacio.</p> : <div className="space-y-3">
        {cart.map((item) => <div className="flex flex-col gap-3 rounded-2xl bg-orange-50 p-4 ring-1 ring-orange-100 sm:flex-row sm:items-center sm:justify-between" key={item.product.id}>
          <div><p className="font-bold">{item.product.name}</p><p className="text-sm font-medium text-[var(--muted)]">{money.format(item.product.price)} c/u</p></div>
          <div className="flex items-center gap-3">
            <input className="input w-24" type="number" min="1" max={item.product.stock} value={item.quantity} onChange={(event) => setCart((current) => current.map((row) => row.product.id === item.product.id ? { ...row, quantity: Number(event.target.value) } : row))} />
            <button className="btn-secondary" onClick={() => setCart((current) => current.filter((row) => row.product.id !== item.product.id))}>Quitar</button>
          </div>
        </div>)}
      </div>}
    </section>
    <form className="card space-y-4 p-5" onSubmit={placeOrder}>
      <h2 className="section-title">Finalizar compra</h2>
      <input className="input" name="customerName" defaultValue={user?.name || ""} placeholder="Nombre" required />
      <input className="input" name="customerEmail" defaultValue={user?.email || ""} placeholder="Email" type="email" required />
      <input className="input" name="customerPhone" defaultValue={user?.phone || ""} placeholder="Telefono" />
      <select className="input" name="deliveryMethod"><option value="retiro">Retiro en tienda</option><option value="delivery">Delivery</option></select>
      <select className="input" name="paymentMethod"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="mercadopago">MercadoPago</option></select>
      <textarea className="input" name="notes" placeholder="Notas del pedido" />
      <div className="flex items-center justify-between border-t border-orange-100 pt-4"><span>Total</span><strong className="text-3xl text-[var(--tomato)]">{money.format(total)}</strong></div>
      <button className="btn w-full" disabled={cart.length === 0}>Crear pedido</button>
    </form>
  </div>;
}

function Auth({ api, login }: { api: <T>(path: string, options?: RequestInit) => Promise<T>; login: (token: string, user: User) => void }) {
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    login(payload.token, payload.user);
  }
  return <form className="card mx-auto max-w-md space-y-4 p-6" onSubmit={submit}>
    <h2 className="section-title">Ingresar</h2>
    <input className="input" name="email" defaultValue="admin@tienda.local" type="email" required />
    <input className="input" name="password" defaultValue="admin123" type="password" required />
    <button className="btn w-full">Iniciar sesion</button>
    <p className="text-sm font-medium text-[var(--muted)]">Demo: admin@tienda.local / admin123, vendedor@tienda.local / vendedor123, cliente@tienda.local / cliente123</p>
  </form>;
}

function Orders({ orders, token, isStaff, api, reload }: { orders: Order[]; token: string; isStaff: boolean; api: <T>(path: string, options?: RequestInit) => Promise<T>; reload: () => Promise<void> }) {
  if (!token) return <p className="text-[var(--muted)]">Inicia sesion para ver pedidos.</p>;
  async function setStatus(id: string, status: string) {
    await api(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    await reload();
  }
  return <section className="space-y-4"><h2 className="section-title">Pedidos</h2>{orders.map((order) => <article className="card p-5" key={order.id}>
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="font-bold">#{order.id.slice(0, 8)} - {order.customer_name}</p><p className="text-sm font-medium text-[var(--muted)]">{new Date(order.created_at).toLocaleString()} - {order.delivery_method} - {order.payment_method}</p></div><strong className="text-xl text-[var(--tomato)]">{money.format(order.total)}</strong></div>
    <div className="mt-3 flex flex-wrap gap-2">{order.items.map((item) => <span className="badge" key={`${order.id}-${item.productName}`}>{item.productName} x{item.quantity}</span>)}</div>
    <div className="mt-4 flex items-center gap-3"><StockBadge status={order.status as never} label={order.status} />{isStaff && <select className="input max-w-56" value={order.status} onChange={(event) => setStatus(order.id, event.target.value)}>{["pendiente", "pagado", "preparando", "listo", "entregado", "cancelado"].map((status) => <option key={status}>{status}</option>)}</select>}</div>
  </article>)}</section>;
}

function Inventory({ products, movements, api, reload }: { products: Product[]; movements: Movement[]; api: <T>(path: string, options?: RequestInit) => Promise<T>; reload: () => Promise<void> }) {
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/inventory/movements", { method: "POST", body: JSON.stringify({ productId: form.get("productId"), type: form.get("type"), quantity: form.get("quantity"), note: form.get("note") }) });
    event.currentTarget.reset();
    await reload();
  }
  return <div className="grid gap-6 lg:grid-cols-[420px_1fr]"><form className="card space-y-4 p-5" onSubmit={submit}><h2 className="section-title">Movimiento de stock</h2><select className="input" name="productId">{products.map((product) => <option value={product.id} key={product.id}>{product.code} - {product.name}</option>)}</select><select className="input" name="type"><option value="entrada">Entrada</option><option value="salida">Salida</option><option value="ajuste">Ajuste a cantidad exacta</option></select><input className="input" name="quantity" type="number" min="0" required placeholder="Cantidad" /><input className="input" name="note" placeholder="Nota" /><button className="btn w-full">Registrar</button></form><section className="card overflow-hidden p-5"><h2 className="section-title">Ultimos movimientos</h2><div className="overflow-x-auto"><table className="table"><thead><tr><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Stock</th><th>Fecha</th></tr></thead><tbody>{movements.map((item) => <tr key={item.id}><td>{item.product_code} {item.product_name}</td><td>{item.type}</td><td>{item.quantity}</td><td>{item.previous_stock} {"->"} {item.new_stock}</td><td>{new Date(item.created_at).toLocaleString()}</td></tr>)}</tbody></table></div></section></div>;
}

function ProductAdmin({ products, categories, api, reload }: { products: Product[]; categories: Category[]; api: <T>(path: string, options?: RequestInit) => Promise<T>; reload: () => Promise<void> }) {
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/products", { method: "POST", body: JSON.stringify({ code: form.get("code"), name: form.get("name"), description: form.get("description"), categoryId: form.get("categoryId"), price: form.get("price"), imageUrl: form.get("imageUrl"), stock: form.get("stock"), minStock: form.get("minStock") }) });
    event.currentTarget.reset();
    await reload();
  }
  return <div className="grid gap-6 lg:grid-cols-[420px_1fr]"><form className="card space-y-4 p-5" onSubmit={submit}><h2 className="section-title">Nuevo producto</h2><input className="input" name="code" placeholder="Codigo" required /><input className="input" name="name" placeholder="Nombre" required /><textarea className="input" name="description" placeholder="Descripcion" /><select className="input" name="categoryId">{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><input className="input" name="price" type="number" min="0" placeholder="Precio" required /><input className="input" name="stock" type="number" min="0" placeholder="Stock inicial" required /><input className="input" name="minStock" type="number" min="0" placeholder="Stock minimo" required /><input className="input" name="imageUrl" placeholder="URL imagen" /><button className="btn w-full">Crear producto</button></form><section className="card overflow-hidden p-5"><h2 className="section-title">Productos</h2><div className="overflow-x-auto"><table className="table"><thead><tr><th>Codigo</th><th>Producto</th><th>Categoria</th><th>Precio</th><th>Stock</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.code}</td><td>{product.name}</td><td>{product.category_name}</td><td>{money.format(product.price)}</td><td>{product.stock}</td></tr>)}</tbody></table></div></section></div>;
}

function Reports({ report }: { report: Report | null }) {
  if (!report) return <p>Cargando reportes...</p>;
  return <section className="space-y-6"><h2 className="section-title">Reportes</h2><div className="grid gap-4 md:grid-cols-4">{[["Pedidos", report.orders], ["Ingresos", money.format(report.revenue)], ["Productos", report.products], ["Stock bajo", report.low_stock]].map(([label, value]) => <div className="card p-5" key={label}><p className="text-sm font-medium text-[var(--muted)]">{label}</p><p className="text-3xl font-black text-[var(--tomato)]">{value}</p></div>)}</div><div className="card p-5"><h3 className="mb-4 text-xl font-bold">Productos mas vendidos</h3><div className="space-y-3">{report.topProducts.map((item) => <div className="flex justify-between rounded-2xl bg-orange-50 p-3 ring-1 ring-orange-100" key={item.product_name}><span>{item.product_name} x{item.quantity}</span><strong>{money.format(item.revenue)}</strong></div>)}</div></div></section>;
}

function StockBadge({ status, label }: { status: string; label?: string }) {
  const className = status === "agotado" || status === "cancelado" ? "bg-red-100 text-red-800" : status === "bajo_stock" || status === "pendiente" ? "bg-yellow-100 text-yellow-800" : "bg-emerald-100 text-emerald-800";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${className}`}>{label || status.replace("_", " ")}</span>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
