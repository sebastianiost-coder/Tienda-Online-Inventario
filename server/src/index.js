import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { query, transaction } from "./db.js";
import { migrateAndSeed } from "./schema.js";

const app = express();
const port = Number(process.env.PORT || 8088);
const jwtSecret = process.env.JWT_SECRET || "local-dev-secret-change-me";

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || true }));
app.use(express.json({ limit: "1mb" }));

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email, name: user.name }, jwtSecret, { expiresIn: "7d" });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Token requerido" });
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: "Token invalido" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: "Permisos insuficientes" });
    next();
  };
}

app.get("/api/health", asyncHandler(async (_req, res) => {
  await query("SELECT 1");
  res.json({ ok: true, service: "tienda-inventario-api" });
}));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await query("SELECT * FROM users WHERE email = $1", [email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }
  res.json({ token: signToken(user), user: sanitizeUser(user) });
}));

app.post("/api/auth/register", asyncHandler(async (req, res) => {
  const { name, email, password, phone, address } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Nombre, email y password son requeridos" });
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role, phone, address)
     VALUES ($1, $2, $3, 'cliente', $4, $5)
     RETURNING id, name, email, role, phone, address, created_at`,
    [name, email, passwordHash, phone || null, address || null]
  );
  const user = result.rows[0];
  res.status(201).json({ token: signToken(user), user });
}));

app.get("/api/auth/me", requireAuth, asyncHandler(async (req, res) => {
  const result = await query("SELECT id, name, email, role, phone, address, created_at FROM users WHERE id = $1", [req.user.id]);
  res.json(result.rows[0]);
}));

app.get("/api/categories", asyncHandler(async (_req, res) => {
  const result = await query("SELECT * FROM categories ORDER BY name");
  res.json(result.rows);
}));

app.get("/api/products", asyncHandler(async (req, res) => {
  const { search = "", category = "", includeInactive = "false" } = req.query;
  const result = await query(
    `SELECT p.*, c.name AS category_name,
      CASE WHEN p.stock = 0 THEN 'agotado' WHEN p.stock <= p.min_stock THEN 'bajo_stock' ELSE 'disponible' END AS stock_status
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE ($1 = '' OR lower(p.name) LIKE lower('%' || $1 || '%') OR lower(p.code) LIKE lower('%' || $1 || '%'))
       AND ($2 = '' OR c.name = $2)
       AND ($3 = 'true' OR p.active = true)
     ORDER BY p.name`,
    [search, category, includeInactive]
  );
  res.json(result.rows);
}));

app.post("/api/products", requireAuth, requireRole("admin", "vendedor"), asyncHandler(async (req, res) => {
  const { code, name, description, categoryId, price, imageUrl, stock, minStock } = req.body;
  const result = await query(
    `INSERT INTO products (code, name, description, category_id, price, image_url, stock, min_stock)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [code, name, description || "", categoryId, Number(price), imageUrl || null, Number(stock || 0), Number(minStock || 10)]
  );
  res.status(201).json(result.rows[0]);
}));

app.put("/api/products/:id", requireAuth, requireRole("admin", "vendedor"), asyncHandler(async (req, res) => {
  const { code, name, description, categoryId, price, imageUrl, minStock, active } = req.body;
  const result = await query(
    `UPDATE products SET code=$1, name=$2, description=$3, category_id=$4, price=$5, image_url=$6, min_stock=$7, active=$8, updated_at=now()
     WHERE id=$9 RETURNING *`,
    [code, name, description || "", categoryId, Number(price), imageUrl || null, Number(minStock || 10), Boolean(active), req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Producto no encontrado" });
  res.json(result.rows[0]);
}));

app.delete("/api/products/:id", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  await query("UPDATE products SET active=false, updated_at=now() WHERE id=$1", [req.params.id]);
  res.status(204).end();
}));

app.post("/api/inventory/movements", requireAuth, requireRole("admin", "vendedor"), asyncHandler(async (req, res) => {
  const { productId, type, quantity, note } = req.body;
  const qty = Number(quantity);
  const movement = await transaction(async (client) => {
    const productResult = await client.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [productId]);
    const product = productResult.rows[0];
    if (!product) throw Object.assign(new Error("Producto no encontrado"), { status: 404 });
    const previousStock = Number(product.stock);
    const newStock = type === "entrada" ? previousStock + qty : type === "ajuste" ? qty : previousStock - qty;
    if (newStock < 0) throw Object.assign(new Error("El stock no puede quedar negativo"), { status: 400 });
    await client.query("UPDATE products SET stock=$1, updated_at=now() WHERE id=$2", [newStock, productId]);
    const inserted = await client.query(
      `INSERT INTO stock_movements (product_id, user_id, type, quantity, previous_stock, new_stock, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [productId, req.user.id, type, qty, previousStock, newStock, note || null]
    );
    return inserted.rows[0];
  });
  res.status(201).json(movement);
}));

app.get("/api/inventory/movements", requireAuth, requireRole("admin", "vendedor"), asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT sm.*, p.name AS product_name, p.code AS product_code, u.name AS user_name
     FROM stock_movements sm
     JOIN products p ON p.id = sm.product_id
     LEFT JOIN users u ON u.id = sm.user_id
     ORDER BY sm.created_at DESC LIMIT 100`
  );
  res.json(result.rows);
}));

app.post("/api/orders", asyncHandler(async (req, res) => {
  const { customerName, customerEmail, customerPhone, deliveryMethod, paymentMethod, notes, items } = req.body;
  if (!customerName || !customerEmail || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Datos de pedido incompletos" });
  }
  const order = await transaction(async (client) => {
    let total = 0;
    const products = [];
    for (const item of items) {
      const productResult = await client.query("SELECT * FROM products WHERE id=$1 AND active=true FOR UPDATE", [item.productId]);
      const product = productResult.rows[0];
      const quantity = Number(item.quantity);
      if (!product) throw Object.assign(new Error("Producto no encontrado"), { status: 404 });
      if (product.stock < quantity) throw Object.assign(new Error(`Stock insuficiente para ${product.name}`), { status: 400 });
      total += product.price * quantity;
      products.push({ product, quantity });
    }
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, delivery_method, payment_method, total, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user?.id || null, customerName, customerEmail, customerPhone || null, deliveryMethod, paymentMethod, total, notes || null]
    );
    const createdOrder = orderResult.rows[0];
    for (const { product, quantity } of products) {
      const newStock = product.stock - quantity;
      await client.query("UPDATE products SET stock=$1, updated_at=now() WHERE id=$2", [newStock, product.id]);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [createdOrder.id, product.id, product.name, product.price, quantity, product.price * quantity]
      );
      await client.query(
        `INSERT INTO stock_movements (product_id, user_id, type, quantity, previous_stock, new_stock, note)
         VALUES ($1, $2, 'consumo', $3, $4, $5, $6)`,
        [product.id, req.user?.id || null, quantity, product.stock, newStock, `Pedido ${createdOrder.id}`]
      );
    }
    return createdOrder;
  });
  res.status(201).json(order);
}));

app.get("/api/orders", requireAuth, asyncHandler(async (req, res) => {
  const params = [];
  const customerFilter = req.user.role === "cliente" ? "WHERE o.customer_email = $1" : "";
  if (req.user.role === "cliente") params.push(req.user.email);
  const result = await query(
    `SELECT o.*, COALESCE(json_agg(json_build_object('id', oi.id, 'productName', oi.product_name, 'quantity', oi.quantity, 'unitPrice', oi.unit_price, 'subtotal', oi.subtotal)) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ${customerFilter}
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    params
  );
  res.json(result.rows);
}));

app.patch("/api/orders/:id/status", requireAuth, requireRole("admin", "vendedor"), asyncHandler(async (req, res) => {
  const { status } = req.body;
  const result = await query("UPDATE orders SET status=$1, updated_at=now() WHERE id=$2 RETURNING *", [status, req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Pedido no encontrado" });
  res.json(result.rows[0]);
}));

app.get("/api/users", requireAuth, requireRole("admin"), asyncHandler(async (_req, res) => {
  const result = await query("SELECT id, name, email, role, phone, address, created_at FROM users ORDER BY created_at DESC");
  res.json(result.rows);
}));

app.get("/api/reports/summary", requireAuth, requireRole("admin", "vendedor"), asyncHandler(async (_req, res) => {
  const [sales, products, lowStock, topProducts] = await Promise.all([
    query("SELECT COUNT(*)::int AS orders, COALESCE(SUM(total), 0)::int AS revenue FROM orders WHERE status <> 'cancelado'"),
    query("SELECT COUNT(*)::int AS products FROM products WHERE active=true"),
    query("SELECT COUNT(*)::int AS low_stock FROM products WHERE active=true AND stock <= min_stock"),
    query(`SELECT oi.product_name, SUM(oi.quantity)::int AS quantity, SUM(oi.subtotal)::int AS revenue
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE o.status <> 'cancelado'
           GROUP BY oi.product_name ORDER BY quantity DESC LIMIT 5`),
  ]);
  res.json({ ...sales.rows[0], ...products.rows[0], ...lowStock.rows[0], topProducts: topProducts.rows });
}));

function sanitizeUser(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

app.use((req, res) => res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` }));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || "Error interno" });
});

await migrateAndSeed();
app.listen(port, "0.0.0.0", () => {
  console.log(`API lista en puerto ${port}`);
});
