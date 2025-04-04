# API Microservices Architecture

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-16.x-green)
![Docker](https://img.shields.io/badge/Docker-Compose-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 📋 Description

Complete microservices architecture designed for high-availability and scalable enterprise applications. Implements modern design patterns and best practices to build maintainable and robust distributed applications.

## 🌟 Key Features

- **Centralized API Gateway** with authentication, authorization, and rate limiting
- **Independent services** for users, products, orders, etc.
- **Asynchronous communication** between services using message queues (RabbitMQ)
- **Multiple databases** (MongoDB for auth/users/orders, MySQL for products)
- **Distributed cache** with Redis for improved performance
- **Circuit breaker** for handling cascading failures
- **OpenAPI documentation** generated automatically
- **Comprehensive monitoring** with Prometheus and Grafana

## 🏗️ Architecture

```
api-microservices/
├── gateway/                    # API Gateway (Node.js/Express)
│   ├── src/
│   │   ├── middleware/         # Auth, rate limiting, logging
│   │   ├── routes/             # Route definitions and proxies
│   │   └── services/           # Internal services
│   └── Dockerfile
├── services/
│   ├── auth-service/           # Authentication service (MongoDB)
│   │   ├── src/
│   │   │   ├── controllers/    # Business logic
│   │   │   ├── models/         # Schemas and models
│   │   │   ├── routes/         # API endpoints
│   │   │   ├── messaging/      # RabbitMQ integration
│   │   │   └── utils/          # Utilities
│   │   └── Dockerfile
│   ├── user-service/           # User management (MongoDB)
│   │   ├── src/
│   │   │   ├── controllers/    # Business logic
│   │   │   ├── models/         # Schemas and models
│   │   │   ├── routes/         # API endpoints
│   │   │   ├── messaging/      # RabbitMQ integration
│   │   │   └── utils/          # Utilities
│   │   └── Dockerfile
│   ├── product-service/        # Product management (MySQL)
│   │   ├── src/
│   │   │   ├── controllers/    # Business logic
│   │   │   ├── models/         # Sequelize models
│   │   │   ├── routes/         # API endpoints
│   │   │   ├── messaging/      # RabbitMQ integration
│   │   │   └── utils/          # Utilities
│   │   └── Dockerfile
│   └── order-service/          # Order management (MongoDB)
│       ├── src/
│       │   ├── controllers/    # Business logic
│       │   ├── models/         # Schemas and models
│       │   ├── routes/         # API endpoints
│       │   ├── messaging/      # RabbitMQ integration
│       │   └── utils/          # Utilities
│       └── Dockerfile
├── shared-lib/                 # Shared code between services
│   ├── models/
│   ├── utils/
│   └── middleware/
├── infrastructure/             # Infrastructure configuration
│   ├── docker-compose.yml      # Development environment
│   ├── kubernetes/             # K8s manifests for production
│   └── monitoring/             # Prometheus/Grafana config
└── docs/                       # Documentation and diagrams
```

## 🚀 Technologies Used

### Backend
- **Node.js** and **Express.js** as the main framework
- **MongoDB** (auth, users, orders) and **MySQL** (products)
- **Redis** for cache and session management
- **Sequelize** as ORM for MySQL
- **Mongoose** for MongoDB models

### Communication
- **RabbitMQ** for messaging and events between services
- **REST APIs** with JSON format
- **JWT** for authentication between services

### Infrastructure
- **Docker** and **Docker Compose** for development
- **Kubernetes** for production orchestration
- **Prometheus** and **Grafana** for monitoring
- **MongoDB Express** and **phpMyAdmin** for database administration

### Security
- **JWT** for authentication
- **bcrypt** for password hashing
- **Helmet.js** for security headers
- **Express Rate Limit** for DoS attack protection
- **express-validator** for input validation

## 🔧 Installation

### Prerequisites
- Node.js 16.x or higher
- Docker and Docker Compose
- Git

### Development Environment Setup

```bash
# Clone the repository
git clone https://github.com/your-username/api-microservices.git
cd api-microservices

# Install dependencies
npm run bootstrap  # Lerna script to install dependencies for all services

# Configure environment variables
cp .env.example .env

# Start all services with Docker Compose
docker-compose up -d

# Start in development mode (with hot-reload)
npm run dev
```

## 🌐 Services and Ports

| Service | Port | Description |
|----------|--------|-------------|
| API Gateway | 3000 | Main entry point for the API |
| Auth Service | 3001 | Authentication and token management |
| User Service | 3002 | User and profile management |
| Product Service | 3003 | Product and category management |
| Order Service | 3004 | Order and payment management |
| MongoDB | 27017 | Database for auth, users, and orders |
| MongoDB Express | 8081 | Web interface for MongoDB |
| MySQL | 3306 | Database for products |
| phpMyAdmin | 8080 | Web interface for MySQL |
| Redis | 6379 | Cache and session storage |
| RabbitMQ | 5672 | Messaging between services |
| RabbitMQ Management | 15672 | Web interface for RabbitMQ |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3100 | Metrics visualization |

## 📝 API Documentation

API documentation is available at:
- Swagger UI: http://localhost:3000/api-docs

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run all tests
npm run test:all

# Check coverage
npm run test:coverage
```

## 🔄 Inter-Service Communication

The architecture uses an event-based asynchronous communication model with RabbitMQ:

1. **Event Publishing**: When a service makes an important change, it publishes an event.
2. **Event Subscription**: Interested services subscribe to specific events.
3. **Event Handling**: Each service processes received events according to its logic.

### Main Events

| Publisher Service | Event | Subscriber Services | Description |
|-----------------|--------|----------------------|-------------|
| Auth Service | user.created | User Service | User created |
| Auth Service | user.email_verified | User Service | Email verified |
| User Service | user.profile_updated | Auth Service | Profile updated |
| Order Service | order.created | Product Service | Order created (reserve inventory) |
| Order Service | order.paid | Product Service | Order paid (update inventory) |
| Order Service | order.cancelled | Product Service | Order cancelled (release inventory) |
| Product Service | product.inventory.updated | Order Service | Inventory updated |

## 🚢 Production Deployment

To deploy in a production environment with Kubernetes:

```bash
# Build and publish Docker images
docker-compose build
docker-compose push

# Apply Kubernetes configuration
kubectl apply -f infrastructure/kubernetes/
```

## 👨‍💻 Contributions

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for more details about our code of conduct and pull request process.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📬 Contact

Edgar Alberto Ng Angulo - [its_shark03@protonmail.com](mailto:its_shark03@protonmail.com)

---

⭐ Star this repository if you find it useful!