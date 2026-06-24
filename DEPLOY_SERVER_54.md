# Despliegue En Servidor 54

Guia basada en el patron usado en `CLUBES DEPORTIVOS DEMO`: Docker Compose con PostgreSQL, API Express, frontend Nginx y proxy Caddy.

## Datos A Confirmar

- IP completa del servidor 54: `<IP_SERVIDOR_54>`
- Dominio o subdominio: `<DOMINIO_TIENDA>`
- Llave SSH local: `server-desarrollo.pem` o la llave que corresponda
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

Ejecutar desde la maquina local, reemplazando placeholders:

```bash
ssh -i server-desarrollo.pem ec2-user@<IP_SERVIDOR_54>
```

En el servidor, respaldar si ya existia una version previa:

```bash
mkdir -p /home/ec2-user/backups/tienda-online-inventario
test -d /home/ec2-user/tienda-online-inventario && cp -a /home/ec2-user/tienda-online-inventario /home/ec2-user/backups/tienda-online-inventario/$(date +%Y%m%d-%H%M%S)
```

Subir el proyecto desde local:

```bash
scp -i server-desarrollo.pem -r "./TIENDA ONLINE + INVENTARIO" ec2-user@<IP_SERVIDOR_54>:/home/ec2-user/tienda-online-inventario
```

Configurar variables en el servidor:

```bash
cd /home/ec2-user/tienda-online-inventario
cp .env.docker.example .env.docker
nano .env.docker
```

Valores minimos a cambiar:

```env
APP_HOST=<DOMINIO_TIENDA>
HTTP_PORT=8087
POSTGRES_PASSWORD=<password_larga>
DATABASE_URL=postgres://tienda_user:<password_larga>@db:5432/tienda_inventario
JWT_SECRET=<secreto_largo_unico>
CORS_ORIGIN=https://<DOMINIO_TIENDA>,http://<DOMINIO_TIENDA>:8087
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
curl -s http://localhost:8087/api/health
curl -s http://<DOMINIO_TIENDA>:8087/api/health
```

## Despliegue Desde GitHub En Servidor

Cuando el repositorio este subido:

```bash
ssh -i server-desarrollo.pem ec2-user@<IP_SERVIDOR_54>
cd /home/ec2-user
git clone <URL_REPO_GITHUB> tienda-online-inventario
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
