# API Microservices Architecture

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-16.x-green)
![Docker](https://img.shields.io/badge/Docker-Compose-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 📋 Descripción

Arquitectura completa de microservicios diseñada para aplicaciones empresariales de alta disponibilidad y escalabilidad. Implementa patrones de diseño modernos y mejores prácticas para construir aplicaciones distribuidas mantenibles y robustas.

## 🌟 Características principales

- **API Gateway centralizado** con autenticación, autorización y rate limiting
- **Servicios independientes** para usuarios, productos, pedidos, etc.
- **Comunicación asíncrona** entre servicios usando colas de mensajes (RabbitMQ)
- **Múltiples bases de datos** (MongoDB para auth/users/orders, MySQL para productos)
- **Cache distribuida** con Redis para mejorar rendimiento
- **Circuit breaker** para manejo de fallos en cascada
- **Documentación OpenAPI** generada automáticamente
- **Monitoreo integral** con Prometheus y Grafana

## 🏗️ Arquitectura

```
api-microservices/
├── gateway/                    # API Gateway (Node.js/Express)
│   ├── src/
│   │   ├── middleware/         # Auth, rate limiting, logging
│   │   ├── routes/             # Definición de rutas y proxies
│   │   └── services/           # Servicios internos
│   └── Dockerfile
├── services/
│   ├── auth-service/           # Servicio de autenticación (MongoDB)
│   │   ├── src/
│   │   │   ├── controllers/    # Lógica de negocio
│   │   │   ├── models/         # Esquemas y modelos
│   │   │   ├── routes/         # Endpoints de la API
│   │   │   ├── messaging/      # Integración con RabbitMQ
│   │   │   └── utils/          # Utilidades
│   │   └── Dockerfile
│   ├── user-service/           # Gestión de usuarios (MongoDB)
│   │   ├── src/
│   │   │   ├── controllers/    # Lógica de negocio
│   │   │   ├── models/         # Esquemas y modelos
│   │   │   ├── routes/         # Endpoints de la API
│   │   │   ├── messaging/      # Integración con RabbitMQ
│   │   │   └── utils/          # Utilidades
│   │   └── Dockerfile
│   ├── product-service/        # Gestión de productos (MySQL)
│   │   ├── src/
│   │   │   ├── controllers/    # Lógica de negocio
│   │   │   ├── models/         # Modelos con Sequelize
│   │   │   ├── routes/         # Endpoints de la API
│   │   │   ├── messaging/      # Integración con RabbitMQ
│   │   │   └── utils/          # Utilidades
│   │   └── Dockerfile
│   └── order-service/          # Gestión de pedidos (MongoDB)
│       ├── src/
│       │   ├── controllers/    # Lógica de negocio
│       │   ├── models/         # Esquemas y modelos
│       │   ├── routes/         # Endpoints de la API
│       │   ├── messaging/      # Integración con RabbitMQ
│       │   └── utils/          # Utilidades
│       └── Dockerfile
├── shared-lib/                 # Código compartido entre servicios
│   ├── models/
│   ├── utils/
│   └── middleware/
├── infrastructure/             # Configuración de infraestructura
│   ├── docker-compose.yml      # Entorno de desarrollo
│   ├── kubernetes/             # Manifiestos K8s para producción
│   └── monitoring/             # Prometheus/Grafana config
└── docs/                       # Documentación y diagramas
```

## 🚀 Tecnologías utilizadas

### Backend
- **Node.js** y **Express.js** como framework principal
- **MongoDB** (auth, usuarios, órdenes) y **MySQL** (productos)
- **Redis** para caché y control de sesiones
- **Sequelize** como ORM para MySQL
- **Mongoose** para modelos de MongoDB

### Comunicación
- **RabbitMQ** para mensajería y eventos entre servicios
- **REST APIs** con formato JSON
- **JWT** para autenticación entre servicios

### Infraestructura
- **Docker** y **Docker Compose** para desarrollo
- **Kubernetes** para orquestación en producción
- **Prometheus** y **Grafana** para monitoreo
- **MongoDB Express** y **phpMyAdmin** para administración de bases de datos

### Seguridad
- **JWT** para autenticación
- **bcrypt** para hash de contraseñas
- **Helmet.js** para cabeceras de seguridad
- **Express Rate Limit** para protección contra ataques DoS
- **express-validator** para validación de entrada

## 🔧 Instalación

### Requisitos previos
- Node.js 16.x o superior
- Docker y Docker Compose
- Git

### Configuración del entorno de desarrollo

```bash
# Clonar el repositorio
git clone https://github.com/your-username/api-microservices.git
cd api-microservices

# Instalar dependencias
npm run bootstrap  # Script Lerna para instalar dependencias de todos los servicios

# Configurar variables de entorno
cp .env.example .env

# Iniciar todos los servicios con Docker Compose
docker-compose up -d

# Iniciar en modo desarrollo (con hot-reload)
npm run dev
```

## 🌐 Servicios y Puertos

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| API Gateway | 3000 | Punto de entrada principal para la API |
| Auth Service | 3001 | Gestión de autenticación y tokens |
| User Service | 3002 | Gestión de usuarios y perfiles |
| Product Service | 3003 | Gestión de productos y categorías |
| Order Service | 3004 | Gestión de órdenes y pagos |
| MongoDB | 27017 | Base de datos para auth, usuarios y órdenes |
| MongoDB Express | 8081 | Interfaz web para MongoDB |
| MySQL | 3306 | Base de datos para productos |
| phpMyAdmin | 8080 | Interfaz web para MySQL |
| Redis | 6379 | Caché y almacenamiento de sesiones |
| RabbitMQ | 5672 | Mensajería entre servicios |
| RabbitMQ Management | 15672 | Interfaz web para RabbitMQ |
| Prometheus | 9090 | Recolección de métricas |
| Grafana | 3100 | Visualización de métricas |

## 📝 Documentación API

La documentación de la API está disponible en:
- Swagger UI: http://localhost:3000/api-docs

## 🧪 Testing

```bash
# Ejecutar tests unitarios
npm run test

# Ejecutar tests de integración
npm run test:integration

# Ejecutar todos los tests
npm run test:all

# Verificar cobertura
npm run test:coverage
```

## 🔄 Comunicación entre Servicios

La arquitectura utiliza un modelo de comunicación asíncrona basado en eventos con RabbitMQ:

1. **Publicación de Eventos**: Cuando un servicio realiza un cambio importante, publica un evento.
2. **Suscripción a Eventos**: Los servicios interesados se suscriben a eventos específicos.
3. **Manejo de Eventos**: Cada servicio procesa los eventos recibidos según su lógica.

### Principales Eventos

| Servicio Emisor | Evento | Servicios Receptores | Descripción |
|-----------------|--------|----------------------|-------------|
| Auth Service | user.created | User Service | Usuario creado |
| Auth Service | user.email_verified | User Service | Email verificado |
| User Service | user.profile_updated | Auth Service | Perfil actualizado |
| Order Service | order.created | Product Service | Orden creada (reserva inventario) |
| Order Service | order.paid | Product Service | Orden pagada (actualiza inventario) |
| Order Service | order.cancelled | Product Service | Orden cancelada (libera inventario) |
| Product Service | product.inventory.updated | Order Service | Inventario actualizado |

## 🚢 Despliegue en Producción

Para desplegar en un entorno de producción con Kubernetes:

```bash
# Construir y publicar imágenes Docker
docker-compose build
docker-compose push

# Aplicar configuración de Kubernetes
kubectl apply -f infrastructure/kubernetes/
```

## 👨‍💻 Contribuciones

Las contribuciones son bienvenidas. Por favor, lee [CONTRIBUTING.md](CONTRIBUTING.md) para más detalles sobre nuestro código de conducta y proceso de pull requests.

## 📜 Licencia

Este proyecto está licenciado bajo MIT License - ver el archivo [LICENSE](LICENSE) para más detalles.

## 📬 Contacto

Edgar Alberto Ng Angulo - [mr_ng03@hotmail.com](mailto:mr_ng03@hotmail.com)

---

⭐ Star este repositorio si te resulta útil!
