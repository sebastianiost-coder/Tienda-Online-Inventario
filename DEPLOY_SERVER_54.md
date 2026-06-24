# Despliegue En Servidor 54

Guia basada en el patron usado en `CLUBES DEPORTIVOS DEMO`: Docker Compose con PostgreSQL, API Express, frontend Nginx y proxy Caddy.

## Datos De Produccion

- IP servidor 54: `54.210.207.92`
- Dominio objetivo: `tiendaonlinemilanesas.tideapps.com`
- HTTP: `8091`
- HTTPS/proxy externo: `8451`
- Llave SSH local: `proyectos_2026.pem`
- Usuario SSH esperado: `ec2-user`
- Ruta remota sugerida: `/home/ec2-user/tienda-online-inventario`

## Archivos Que Van Al Repo

- `client/`
- `server/`
- `Caddyfile`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `.env.example`
- `.env.docker.example`
- `.gitignore`
- `.dockerignore`
- `README.md`
- `DEPLOY_SERVER_54.md`

## Archivos Que No Van Al Repo

- `.env`
- `.env.docker`
- `.env.*` con credenciales reales
- `node_modules/`
- `client/dist/`
- dumps o backups de PostgreSQL
- logs productivos
- llaves `.pem`

## Primer Despliegue Por SSH/SCP

Ejecutar desde la maquina local:

```bash
ssh -i ./proyectos_2026.pem ec2-user@54.210.207.92
```

En el servidor, respaldar si ya existia una version previa:

```bash
mkdir -p /home/ec2-user/backups/tienda-online-inventario
test -d /home/ec2-user/tienda-online-inventario && cp -a /home/ec2-user/tienda-online-inventario /home/ec2-user/backups/tienda-online-inventario/$(date +%Y%m%d-%H%M%S)
```

Subir el proyecto desde local:

```bash
scp -i ./proyectos_2026.pem -r "./TIENDA ONLINE + INVENTARIO" ec2-user@54.210.207.92:/home/ec2-user/tienda-online-inventario
```

Configurar variables en el servidor:

```bash
cd /home/ec2-user/tienda-online-inventario
cp .env.docker.example .env.docker
nano .env.docker
```

Valores minimos a cambiar:

```env
APP_HOST=tiendaonlinemilanesas.tideapps.com
HTTP_PORT=8091
HTTPS_PORT=8451
POSTGRES_PASSWORD=<password_larga>
DATABASE_URL=postgres://tienda_user:<password_larga>@db:5432/tienda_inventario
JWT_SECRET=<secreto_largo_unico>
CORS_ORIGIN=https://tiendaonlinemilanesas.tideapps.com,https://tiendaonlinemilanesas.tideapps.com:8451,http://tiendaonlinemilanesas.tideapps.com:8091
VITE_API_URL=/api
```

Levantar produccion:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.docker config
docker compose -f docker-compose.prod.yml --env-file .env.docker up --build -d
```

Verificar:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.docker ps
curl -s http://localhost:8091/api/health
curl -s http://tiendaonlinemilanesas.tideapps.com:8091/api/health
curl -k -s https://tiendaonlinemilanesas.tideapps.com:8451/api/health
```

## Despliegue Desde GitHub En Servidor

Cuando el repositorio este subido:

```bash
ssh -i ./proyectos_2026.pem ec2-user@54.210.207.92
cd /home/ec2-user
git clone https://github.com/sebastianiost-coder/Tienda-Online-Inventario.git tienda-online-inventario
cd tienda-online-inventario
cp .env.docker.example .env.docker
nano .env.docker
docker compose -f docker-compose.prod.yml --env-file .env.docker up --build -d
```

Para actualizar luego:

```bash
cd /home/ec2-user/tienda-online-inventario
git pull
docker compose -f docker-compose.prod.yml --env-file .env.docker up --build -d
```

No ejecutar `docker compose down -v` en produccion porque elimina el volumen persistente de PostgreSQL.

Nota: el compose publica los puertos `8091` y `8451` hacia el proxy Caddy interno. Si existe un proxy/TLS externo en el servidor, debe apuntar a estos puertos segun la convencion usada en los otros proyectos TIDE.
