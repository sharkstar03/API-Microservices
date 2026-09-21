# API Microservices

Backend de e-commerce partido en cinco servicios independientes, con un API Gateway
por delante y RabbitMQ para la comunicación entre ellos. Lo monté para tener una base
sobre la que arrancar proyectos sin repetir cada vez el mismo trabajo de autenticación,
proxy, mensajería y despliegue.

[English version](<README(EN).md>)

## Qué hay dentro

| Servicio | Puerto | Almacenamiento | Responsabilidad |
|----------|--------|----------------|-----------------|
| gateway | 3000 | Redis | Punto de entrada único: valida el JWT, aplica rate limiting y hace proxy al servicio que toca |
| auth-service | 3001 | MongoDB + Redis | Registro, login, refresh tokens, recuperación de contraseña, gestión de cuentas |
| user-service | 3002 | MongoDB | Perfiles y direcciones |
| product-service | 3003 | MySQL | Catálogo: productos, categorías, inventario, imágenes, reseñas |
| order-service | 3004 | MongoDB | Órdenes, pagos y envíos |

Infraestructura de apoyo: RabbitMQ (5672, panel en 15672), Redis (6379),
MongoDB (27017, Mongo Express en 8081), MySQL (3306, phpMyAdmin en 8080),
Prometheus (9090) y Grafana (3100).

## Por qué cada servicio usa una base de datos distinta

No es por variar. El catálogo tiene relaciones de verdad —categorías jerárquicas,
inventario ligado a producto, imágenes, reseñas— y ahí MySQL con Sequelize da
integridad referencial y joins que salen gratis. Las órdenes, en cambio, se consultan
casi siempre enteras y sus items solo tienen sentido dentro de la orden, así que van
como documento en MongoDB. Las cuentas y los perfiles siguen la misma lógica.

Redis no guarda datos de negocio: lleva la caché del catálogo, los contadores de rate
limiting y la lista negra de tokens invalidados al cerrar sesión.

## Comunicación entre servicios

Las llamadas del cliente entran siempre por el gateway. Entre servicios, en cambio,
casi todo va por eventos en RabbitMQ, para que ninguno dependa de que otro esté vivo.

| Emisor | Evento | Consumidor | Efecto |
|--------|--------|-----------|--------|
| auth-service | `user.created` | user-service | Crea el perfil asociado |
| auth-service | `user.email_verified` | user-service | Marca el perfil como verificado |
| order-service | `order.created` | product-service | Reserva inventario |
| order-service | `order.paid` | product-service | Convierte la reserva en descuento real de stock |
| order-service | `order.cancelled` | product-service | Libera la reserva |
| product-service | `product.inventory.updated` | order-service | Sincroniza disponibilidad |

## Puesta en marcha

Necesitas Docker y Node 20 o superior.

```bash
git clone https://github.com/sharkstar03/API-Microservices.git
cd API-Microservices

cp .env.example .env    # ajusta al menos JWT_SECRET

docker compose up -d    # levanta los 5 servicios y toda la infraestructura
docker compose logs -f  # para ver qué está pasando
```

Cuando los contenedores estén arriba:

- API: `http://localhost:3000/api/v1`
- Documentación Swagger: `http://localhost:3000/api-docs`
- Health check de cualquier servicio: `GET /health`

Para trabajar sin Docker, con recarga automática:

```bash
npm install   # workspaces: instala los 6 paquetes de una vez
npm run dev   # arranca los 5 servicios en paralelo
```

En ese modo, MongoDB, MySQL, Redis y RabbitMQ tienen que estar corriendo por tu cuenta,
y hay que apuntar las URLs del `.env` a `localhost` en vez de a los nombres de host de
Docker.

## Estructura

```
.
├── gateway/                 API Gateway
│   ├── src/
│   │   ├── middleware/      auth, rate limiting, errores
│   │   ├── routes/          proxies hacia cada servicio
│   │   └── utils/
│   └── Dockerfile
├── services/
│   ├── auth-service/
│   ├── user-service/
│   ├── product-service/
│   └── order-service/       cada uno con src/{controllers,models,routes,messaging,middleware,utils}
├── shared-lib/              código común: circuit breaker, cliente HTTP, paginación, errores
├── infrastructure/
│   ├── kubernetes/          manifiestos para producción
│   └── monitoring/          configuración de Prometheus
├── docker-compose.yml
└── .env.example
```

## Comandos

```bash
npm run dev       # los 5 servicios en local con nodemon
npm start         # docker compose up -d
npm stop          # docker compose down
npm run logs      # seguir los logs de los contenedores
npm test          # tests de todos los workspaces
npm run lint      # eslint sobre todo el monorepo
npm run format    # prettier
```

## Despliegue

Los manifiestos de Kubernetes están en `infrastructure/kubernetes/`. Esperan que
`REGISTRY_URL` e `IMAGE_TAG` estén resueltos y que exista el secreto `app-secrets`
con la clave `jwt-secret`.

```bash
docker compose build
docker compose push
kubectl apply -f infrastructure/kubernetes/
```

## Limitaciones conocidas

Cosas que sé que faltan, por si alguien se topa con ellas:

- **No hay saga ni compensación distribuida.** Si el order-service crea una orden y la
  reserva de inventario falla en el product-service, la orden se queda inconsistente.
  Es el siguiente trabajo importante.
- **El consumidor de RabbitMQ reencola indefinidamente.** Ante un error no recuperable
  hace `nack` con requeue, así que un mensaje envenenado gira para siempre. Falta una
  dead letter queue.
- **El pago está simulado.** `paymentController` no habla con ninguna pasarela real.
- **Todo `/api/v1` pide token**, incluida la lectura del catálogo. Para una tienda real
  el `GET` de productos debería ser público.
- **`shared-lib/` todavía no está enganchada.** El circuit breaker, el cliente HTTP y
  la paginación están escritos, pero ningún servicio los importa: cada uno mantiene su
  propia copia de logger y de la clase de error. Unificarlo es trabajo pendiente.

## Licencia

MIT. Ver [LICENSE](LICENSE).

Edgar Alberto Ng Angulo — mr_ng03@hotmail.com
