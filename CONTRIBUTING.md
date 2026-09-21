# Cómo contribuir

Gracias por el interés. Esto es lo mínimo que necesitas para ponerte a trabajar.

## Entorno

```bash
git clone https://github.com/sharkstar03/API-Microservices.git
cd API-Microservices

npm install             # workspaces, instala los 6 paquetes
cp .env.example .env

docker compose up -d    # infraestructura y servicios
```

Si prefieres correr los servicios fuera de Docker, `npm run dev` los levanta con
nodemon, pero necesitas MongoDB, MySQL, Redis y RabbitMQ disponibles por tu cuenta.

## Dónde va cada cosa

- `gateway/` — autenticación, rate limiting y proxy hacia los servicios
- `services/` — un directorio por microservicio, todos con la misma estructura interna
- `shared-lib/` — utilidades comunes (circuit breaker, cliente HTTP, paginación, errores)
- `infrastructure/` — Kubernetes y configuración de Prometheus

Si añades un servicio nuevo, repite la estructura de `services/user-service`: es la
más completa y sirve de referencia.

## Antes de abrir un PR

```bash
npm run lint
npm test
```

Ambos tienen que pasar. Los commits siguen [Conventional Commits](https://www.conventionalcommits.org/),
por ejemplo `feat: añadir dead letter queue al consumidor de órdenes`.

Trabaja siempre sobre una rama:

```bash
git checkout -b feat/lo-que-sea
```

## Reportar un bug

Abre un issue e incluye qué esperabas, qué pasó, y los pasos para reproducirlo. Si el
fallo es de un servicio concreto, adjunta la salida de `docker compose logs <servicio>`.
