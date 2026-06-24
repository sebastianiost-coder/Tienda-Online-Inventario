# Tienda Online + Inventario

Sistema local Docker para venta de milanesas y productos carnicos con catalogo, carrito, pedidos, inventario, reportes y roles.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Node.js + Express
- Base de datos: PostgreSQL
- Autenticacion: JWT
- Orquestacion local: Docker Compose

## Ejecutar Local

```bash
docker compose up --build
```

URLs:

- Frontend: http://localhost:5179
- API: http://localhost:8088/api
- Health: http://localhost:8088/api/health
- PostgreSQL local: localhost:5439

## Usuarios Demo

- Admin: `admin@tienda.local` / `admin123`
- Vendedor: `vendedor@tienda.local` / `vendedor123`
- Cliente: `cliente@tienda.local` / `cliente123`

## Comandos Utiles

```bash
docker compose up --build
docker compose down
docker compose logs -f api
docker compose logs -f client
docker compose down -v   # elimina datos locales
```

## Preparar Servidor Propio

1. Copiar el proyecto al servidor.
2. Crear `.env` desde `.env.example` y cambiar claves/credenciales.
3. Apuntar `CORS_ORIGIN` al dominio real.
4. Ejecutar:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

La configuracion productiva expone `web` en el puerto 80, sirve React como archivos estaticos y redirige `/api` hacia Express.

Para HTTPS, poner Caddy, Nginx Proxy Manager o un balanceador delante del puerto 80.

## Alcance Inicial

- Catalogo con busqueda y filtros por categoria.
- Carrito con cantidades y total en tiempo real.
- Creacion de pedidos con validacion de stock.
- Panel de pedidos con cambio de estado para admin/vendedor.
- CRUD de productos para admin/vendedor.
- Inventario con movimientos de entrada, salida, ajuste, consumo y alertas de stock bajo.
- Clientes y reportes basicos de ventas.
