import bcrypt from "bcryptjs";
import { query } from "./db.js";

export async function migrateAndSeed() {
  await query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'vendedor', 'cliente')),
      phone TEXT,
      address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category_id UUID NOT NULL REFERENCES categories(id),
      price INTEGER NOT NULL CHECK (price >= 0),
      image_url TEXT,
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      min_stock INTEGER NOT NULL DEFAULT 10 CHECK (min_stock >= 0),
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id),
      user_id UUID REFERENCES users(id),
      type TEXT NOT NULL CHECK (type IN ('entrada', 'salida', 'ajuste', 'consumo', 'reversa')),
      quantity INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT,
      delivery_method TEXT NOT NULL CHECK (delivery_method IN ('retiro', 'delivery')),
      payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'transferencia', 'mercadopago')),
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagado', 'preparando', 'listo', 'entregado', 'cancelado')),
      total INTEGER NOT NULL CHECK (total >= 0),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      subtotal INTEGER NOT NULL
    );
  `);

  const adminHash = await bcrypt.hash("admin123", 10);
  const vendedorHash = await bcrypt.hash("vendedor123", 10);
  const clienteHash = await bcrypt.hash("cliente123", 10);

  await query(
    `INSERT INTO users (name, email, password_hash, role, phone, address)
     VALUES
      ('Administrador', 'admin@tienda.local', $1, 'admin', '+56 9 1111 1111', 'Casa Matriz'),
      ('Vendedor', 'vendedor@tienda.local', $2, 'vendedor', '+56 9 2222 2222', 'Sucursal'),
      ('Cliente Demo', 'cliente@tienda.local', $3, 'cliente', '+56 9 3333 3333', 'Direccion demo')
     ON CONFLICT (email) DO NOTHING`,
    [adminHash, vendedorHash, clienteHash]
  );

  await query(`
    INSERT INTO categories (name, description)
    VALUES
      ('Milanesas', 'Milanesas de vacuno y cerdo listas para preparar'),
      ('Milanesas congeladas', 'Milanesas congeladas Hoy Milanesas en formato de 1 kilo'),
      ('Hamburguesas', 'Hamburguesas artesanales por porcion'),
      ('Cortes', 'Cortes de vacuno y cerdo por kilo'),
      ('Embutidos', 'Chorizos, salchichas y preparados'),
      ('Cerdo', 'Productos seleccionados de cerdo')
    ON CONFLICT (name) DO NOTHING;
  `);

  await query(`
    INSERT INTO products (code, name, description, category_id, price, image_url, stock, min_stock)
    SELECT p.code, p.name, p.description, c.id, p.price, p.image_url, p.stock, p.min_stock
    FROM (VALUES
      ('MIL-001', 'Milanesa de vacuno (500g)', 'Milanesa apanada de vacuno, porcion familiar de 500g.', 'Milanesas', 8990, 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=900&q=80', 45, 20),
      ('MIL-002', 'Milanesa de cerdo (500g)', 'Milanesa de cerdo apanada, sabrosa y lista para cocinar.', 'Milanesas', 7990, 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=900&q=80', 36, 20),
      ('HAM-001', 'Hamburguesa de vacuno (4 unidades)', 'Pack de 4 hamburguesas de vacuno artesanal.', 'Hamburguesas', 5990, 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80', 70, 30),
      ('HAM-002', 'Hamburguesa de cerdo (4 unidades)', 'Pack de hamburguesas de cerdo condimentadas.', 'Hamburguesas', 4990, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80', 52, 30),
      ('COR-001', 'Corte bifester (1kg)', 'Corte de vacuno para plancha, venta por kilo.', 'Cortes', 12990, 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=900&q=80', 22, 15),
      ('COR-002', 'Costilla de cerdo (1kg)', 'Costilla de cerdo fresca, ideal para horno o parrilla.', 'Cortes', 10990, 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80', 19, 15),
      ('EMB-001', 'Chorizo (1kg)', 'Chorizo artesanal por kilo.', 'Embutidos', 6990, 'https://images.unsplash.com/photo-1598514982901-ae62764ae75e?auto=format&fit=crop&w=900&q=80', 40, 25),
      ('EMB-002', 'Salchicha (1kg)', 'Salchicha fresca para completos o parrilla.', 'Embutidos', 5990, 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=900&q=80', 28, 25),
      ('HMC-001', 'Milanesas de vacuno congeladas (1kg)', 'Receta argentina Hoy Milanesas. Formato congelado de 1 kilo, listo para freir, hornear o preparar en air fryer.', 'Milanesas congeladas', 15000, 'https://placehold.co/900x600/ffd234/24201d?text=Milanesas+Vacuno+1kg', 60, 15),
      ('HMC-002', 'Milanesas de pollo congeladas (1kg)', 'Receta argentina Hoy Milanesas. Formato congelado de 1 kilo de pollo, liviano y practico para comidas familiares.', 'Milanesas congeladas', 12000, 'https://placehold.co/900x600/ffd234/24201d?text=Milanesas+Pollo+1kg', 60, 15),
      ('HMC-003', 'Milanesas veggie congeladas (1kg)', 'Milanesas veggie congeladas Hoy Milanesas. Consulta por opciones vegetarianas y veganas disponibles.', 'Milanesas congeladas', 8000, 'https://placehold.co/900x600/ffd234/24201d?text=Milanesas+Veggie+1kg', 40, 10)
    ) AS p(code, name, description, category_name, price, image_url, stock, min_stock)
    JOIN categories c ON c.name = p.category_name
    ON CONFLICT (code) DO NOTHING;
  `);
}
