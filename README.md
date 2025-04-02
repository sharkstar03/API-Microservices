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
- **Comunicación asíncrona** entre servicios usando colas de mensajes
- **Service discovery** y balanceo de carga integrado
- **Circuit breaker** para manejo de fallos en cascada
- **Documentación OpenAPI** generada automáticamente

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
│   ├── auth-service/           # Servicio de autenticación
│   │   ├── src/
│   │   └── Dockerfile
│   ├── user-service/           # Gestión de usuarios
│   │   ├── src/
│   │   └── Dockerfile
│   ├── product-service/        # Gestión de productos
│   │   ├── src/
│   │   └── Dockerfile
│   └── order-service/          # Gestión de pedidos
│       ├── src/
│       └── Dockerfile
├── shared-lib/                 # Código compartido entre servicios
│   ├── models/
│   ├── utils/
│   └── middleware/
├── message-broker/             # Configuración de RabbitMQ
├── infrastructure/             # Configuración de infraestructura
│   ├── docker-compose.yml      # Entorno de desarrollo
│   ├── kubernetes/             # Manifiestos K8s para producción
│   └── monitoring/             # Prometheus/Grafana config
└── docs/                       # Documentación y diagramas
```

## 🚀 Tecnologías utilizadas

### Backend
- Node.js
- Express.js
- MongoDB y MySQL (solución multi-DB)
- Redis para caché y sesiones

### Comunicación
- RabbitMQ para mensajería
- gRPC para comunicación interna
- REST/JSON para API externa
- WebSockets para comunicación en tiempo real

### Infraestructura
- Docker y Docker Compose
- Kubernetes para orquestación
- Nginx como proxy inverso
- Prometheus y Grafana para monitoreo

### Seguridad
- JWT y OAuth2 para autenticación
- HTTPS/TLS
- Helmet.js para cabeceras de seguridad
- Validación de entrada con Joi/Yup

## 📸 Capturas de pantalla

![API Gateway](https://via.placeholder.com/800x400?text=API+Gateway+Dashboard)
![Swagger UI](https://via.placeholder.com/800x400?text=API+Documentation)

## 🔧 Instalación

### Requisitos previos
- Node.js 16.x o superior
- Docker y Docker Compose
- MongoDB y MySQL (o usar las versiones containerizadas)

### Configuración del entorno de desarrollo

```bash
# Clonar el repositorio
git clone https://github.com/sharkstar03/api-microservices.git
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

## 📝 Documentación API

La documentación de la API está disponible en:
- Swagger UI: http://localhost:3000/api-docs
- Postman Collection: [Ver en la carpeta /docs](/docs/postman-collection.json)

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

## 📊 Monitoreo y logs

El sistema incluye:
- **Dashboard Grafana** para métricas de rendimiento
- **Trazabilidad distribuida** con Jaeger
- **Logs centralizados** con ELK Stack
- **Alertas** configuradas para rendimiento y disponibilidad

## 🚢 CI/CD Pipeline

```
Commit → GitHub Actions → Tests → Build → Push Docker Images → Deploy to Kubernetes
```

## 📈 Rendimiento

Resultados de pruebas de carga:
- Soporta >1000 RPS en cada servicio
- Latencia promedio <100ms
- Escalado automático basado en CPU/memoria

## 📝 Roadmap

- [ ] Implementar GraphQL en el gateway
- [ ] Migración a TypeScript
- [ ] Backend for Frontend (BFF) pattern
- [ ] Implementar CQRS en servicios clave
- [ ] Soporte para streaming de eventos

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor, lee [CONTRIBUTING.md](CONTRIBUTING.md) para más detalles sobre nuestro código de conducta y proceso de pull requests.

## 📜 Licencia

Este proyecto está licenciado bajo MIT License - ver el archivo [LICENSE](LICENSE) para más detalles.

## 📬 Contacto

Edgar Alberto Ng Angulo - [its_shark03@protonmail.com](mailto:its_shark03@protonmail.com)

---

⭐ Star este repositorio si te resulta útil!
