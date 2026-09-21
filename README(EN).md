# API Microservices

An e-commerce backend split into five independent services, sitting behind an API
Gateway and talking to each other over RabbitMQ. I built it so I would not have to
redo the same authentication, proxying, messaging and deployment work every time I
start a project.

[Versión en español](README.md)

## What's in here

| Service | Port | Storage | Responsibility |
|---------|------|---------|----------------|
| gateway | 3000 | Redis | Single entry point: validates the JWT, applies rate limiting and proxies to the right service |
| auth-service | 3001 | MongoDB + Redis | Sign-up, login, refresh tokens, password recovery, account management |
| user-service | 3002 | MongoDB | Profiles and addresses |
| product-service | 3003 | MySQL | Catalog: products, categories, inventory, images, reviews |
| order-service | 3004 | MongoDB | Orders, payments and shipping |

Supporting infrastructure: RabbitMQ (5672, dashboard on 15672), Redis (6379),
MongoDB (27017, Mongo Express on 8081), MySQL (3306, phpMyAdmin on 8080),
Prometheus (9090) and Grafana (3100).

## Why each service uses a different database

Not for the sake of variety. The catalog has real relationships — nested categories,
inventory tied to a product, images, reviews — and MySQL with Sequelize gives you
referential integrity and joins for free. Orders, on the other hand, are almost always
read whole and their line items only make sense inside the order, so they live as
documents in MongoDB. Accounts and profiles follow the same reasoning.

Redis holds no business data: it keeps the catalog cache, the rate limiting counters
and the blacklist of tokens invalidated on logout.

## Service communication

Client calls always come in through the gateway. Between services, though, almost
everything goes through RabbitMQ events, so no service depends on another being up.

| Publisher | Event | Consumer | Effect |
|-----------|-------|----------|--------|
| auth-service | `user.created` | user-service | Creates the matching profile |
| auth-service | `user.email_verified` | user-service | Marks the profile as verified |
| order-service | `order.created` | product-service | Reserves inventory |
| order-service | `order.paid` | product-service | Turns the reservation into an actual stock decrease |
| order-service | `order.cancelled` | product-service | Releases the reservation |
| product-service | `product.inventory.updated` | order-service | Syncs availability |

## Getting started

You need Docker and Node 20 or newer.

```bash
git clone https://github.com/sharkstar03/API-Microservices.git
cd API-Microservices

cp .env.example .env    # set at least JWT_SECRET

docker compose up -d    # brings up the 5 services and all the infrastructure
docker compose logs -f  # to see what is going on
```

Once the containers are up:

- API: `http://localhost:3000/api/v1`
- Swagger docs: `http://localhost:3000/api-docs`
- Health check on any service: `GET /health`

To work without Docker, with hot reload:

```bash
npm install   # workspaces: installs all 6 packages at once
npm run dev   # starts the 5 services in parallel
```

In that mode you need MongoDB, MySQL, Redis and RabbitMQ running on your own, and the
URLs in `.env` have to point to `localhost` instead of the Docker host names.

## Layout

```
.
├── gateway/                 API Gateway
│   ├── src/
│   │   ├── middleware/      auth, rate limiting, error handling
│   │   ├── routes/          proxies to each service
│   │   └── utils/
│   └── Dockerfile
├── services/
│   ├── auth-service/
│   ├── user-service/
│   ├── product-service/
│   └── order-service/       each with src/{controllers,models,routes,messaging,middleware,utils}
├── shared-lib/              shared code: circuit breaker, HTTP client, pagination, errors
├── infrastructure/
│   ├── kubernetes/          production manifests
│   └── monitoring/          Prometheus configuration
├── docker-compose.yml
└── .env.example
```

## Commands

```bash
npm run dev       # the 5 services locally with nodemon
npm start         # docker compose up -d
npm stop          # docker compose down
npm run logs      # follow the container logs
npm test          # tests across all workspaces
npm run lint      # eslint over the whole monorepo
npm run format    # prettier
```

## Deployment

The Kubernetes manifests live in `infrastructure/kubernetes/`. They expect
`REGISTRY_URL` and `IMAGE_TAG` to be resolved and an `app-secrets` secret to exist
with a `jwt-secret` key.

```bash
docker compose build
docker compose push
kubectl apply -f infrastructure/kubernetes/
```

## Known limitations

Things I know are missing, in case anyone runs into them:

- **No saga or distributed compensation.** If order-service creates an order and the
  inventory reservation fails in product-service, the order is left inconsistent.
  That is the next significant piece of work.
- **The RabbitMQ consumer requeues forever.** On a non-recoverable error it nacks with
  requeue, so a poison message loops indefinitely. It needs a dead letter queue.
- **Payments are simulated.** `paymentController` does not talk to a real gateway.
- **Everything under `/api/v1` requires a token**, including reading the catalog. For a
  real storefront the product `GET` endpoints should be public.
- **`shared-lib/` is not wired in yet.** The circuit breaker, HTTP client and pagination
  helpers are written, but no service imports them: each one keeps its own copy of the
  logger and the error class. Unifying that is still pending.

## License

MIT. See [LICENSE](LICENSE).

Edgar Alberto Ng Angulo — mr_ng03@hotmail.com
