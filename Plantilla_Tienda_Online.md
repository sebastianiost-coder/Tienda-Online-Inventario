# Plantilla Tienda Online + Inventario

## Visión del Producto
Una tienda online para la venta de milanesas y productos cárnicos, con sistema de inventario integrado para controlar el stock de productos disponibles, pedidos en proceso y ventas realizadas. Los clientes pueden comprar online y el administrador gestiona el inventario.

## Usuarios y Roles
- **Administrador**: Acceso total al sistema, gestiona productos, inventario, pedidos y usuarios.
- **Vendedor**: Puede ver pedidos, actualizar estado de pedidos, gestionar inventario básico.
- **Cliente**: Puede navegar el catálogo, agregar productos al carrito, realizar pedidos, ver historial de compras.
- **Visitante**: Puede navegar el catálogo sin comprar.

---

## Módulos del Sistema

### 1. Catálogo
- El usuario puede ver el catálogo de productos disponibles.
- El usuario puede buscar productos por nombre o categoría.
- El usuario puede filtrar por categoría (milanesas, hamburguesas, cortes, etc.).
- El usuario puede ver detalles de cada producto (nombre, descripción, precio, imagen, disponibilidad).
- El sistema muestra productos disponibles solo cuando hay stock.

### 2. Carrito
- El usuario puede agregar productos al carrito.
- El usuario puede modificar cantidades.
- El usuario puede eliminar productos del carrito.
- El sistema muestra total en tiempo real.
- El usuario puede aplicar códigos de descuento.

### 3. Pedidos
- El usuario puede crear un nuevo pedido desde el carrito.
- El usuario puede seleccionar método de entrega (retiro en tienda, delivery).
- El usuario puede seleccionar método de pago (efectivo, transferencia, MercadoPago).
- El usuario puede ver el historial de pedidos.
- El usuario puede ver el estado de cada pedido (pendiente, preparado, entregado, cancelado).
- El administrador puede cambiar estado del pedido.
- El sistema envía notificaciones al cliente por estado del pedido.

### 4. Inventario
- El administrador puede crear productos y definir stock inicial.
- El administrador puede agregar unidades al stock.
- El administrador puede restar unidades del stock (por venta).
- El sistema alerta cuando stock está bajo (menos de 10 unidades).
- El usuario puede ver historial de movimientos de stock.
- El administrador puede definir stock mínimo por producto.
- El sistema bloquea venta si no hay stock suficiente.

### 5. Clientes
- El administrador puede ver lista de clientes.
- El administrador puede buscar clientes por nombre o email.
- El usuario puede registrarse como cliente.
- El usuario puede editar sus datos de perfil.
- El usuario puede ver su historial de compras.

### 6. Reportes
- El administrador puede ver ventas por día/semana/mes.
- El administrador puede ver productos más vendidos.
- El administrador puede ver ingresos totales.
- El administrador puede exportar reportes.

### 7. Usuarios y Roles
- El administrador puede crear usuarios del sistema.
- El administrador puede asignar roles (admin, vendedor).
- El administrador puede eliminar usuarios.

---

## Productos y Categorías

### Categorías
1. Milanesas (carne厚的)
2. Hamburguesas (carne molida)
3. Cortes (vacuno, cerdo)
4. Embutidos
5. Cerdo

### Productos de ejemplo
| Código | Producto | Categoría | Precio | Stock Mínimo |
|--------|----------|----------|--------|-------------|
| MIL-001 | Milanesa de vacuno (500g) | Milanesas | $8.990 | 20 |
| MIL-002 | Milanesa de cerdo (500g) | Milanesas | $7.990 | 20 |
| HAM-001 | Hamburguesa de vacuno (4 unidades) | Hamburguesas | $5.990 | 30 |
| HAM-002 | Hamburguesa de cerdo (4 unidades) | Hamburguesas | $4.990 | 30 |
| COR-001 | Corte biféster (1kg) | Cortes | $12.990 | 15 |
| COR-002 | Costilla de cerdo (1kg) | Cortes | $10.990 | 15 |
| EMB-001 | Chorizo (1kg) | Embutidos | $6.990 | 25 |
| EMB-002 | Salchicha (1kg) | Embutidos | $5.990 | 25 |

---

## Estados de Pedido
1. **Pendiente**: Pedido creado, esperando pago
2. **Pagado**: Cliente confirmó pago
3. **Preparando**: En preparación en cocina
4. **Listo**: Listo para retiro/entrega
5. **Entregado**: Entregado al cliente
6. **Cancelado**: Pedido cancelado

---

## Estados de Stock
1. **Disponible**: Stock mayor a stock mínimo
2. **Bajo Stock**: Stock menor a mínimo (alerta)
3. **Agotado**: Stock en 0

---

## Métodos de Entrega
1. **Retiro en tienda**: Cliente pasa a buscar
2. **Delivery**: Entrega a domicilio (zona de cobertura)

---

## Métodos de Pago
1. **Efectivo**: Pago al retiro/entrega
2. **Transferencia**: Transferencia bancaria
3. **MercadoPago**: Pago online

---

## Arquitectura Técnica
- **Frontend**: React + Tailwind CSS
- **Backend**: Node.js + Express
- **Base de datos**: PostgreSQL (Supabase o local)
- **Autenticación**: JWT
- **Hosting**: Vercel + Railway
- **Pagos**: MercadoPago o transferencia manual

---

## Flujos Principales

### Ver Catálogo y Comprar
1. El cliente entra al sitio y ve el catálogo.
2. El cliente filtra por categoría si desea.
3. El cliente hace clic en un producto para ver detalles.
4. El cliente hace clic en "Agregar al carrito".
5. El cliente va al carrito y revisa su pedido.
6. El cliente hace clic en "Finalizar compra".
7. El cliente selecciona método de entrega.
8. El cliente selecciona método de pago.
9. El cliente confirma el pedido.
10. Error: si no hay stock, el sistema muestra alerta.

### Gestionar Inventario
1. El administrador va a "Inventario" en el menú.
2. El administrador ve lista de productos con stock actual.
3. El administrador hace clic en "Agregar Stock".
4. El administrador ingresa cantidad a agregar.
5. El sistema actualiza el stock.
6. Error: si stock queda negativo, el sistema alerta.

### Revisar Pedido
1. El administrador va a "Pedidos" en el menú.
2. El administrador ve lista de pedidos pendientes.
3. El administrador hace clic en un pedido.
4. El administrador cambia estado a "Preparado".
5. El sistema notifica al cliente.

### Ver Reportes
1. El administrador va a "Reportes" en el menú.
2. El administrador selecciona período (día, semana, mes).
3. El administrador ve gráficos de ventas.
4. El administrador puede exportar a Excel/PDF.

---

## Especificación para OpenCode

Esta plantilla está diseñada para ser ejecutada con OpenCode usando GPT-5.5. El sistema debe incluir:
- CRUD completo de productos
- Sistema de carrito de compras
- Gestión de pedidos con estados
- Control de inventario en tiempo real
- Alertas de stock bajo
- Reportes de ventas
- Roles y permisos