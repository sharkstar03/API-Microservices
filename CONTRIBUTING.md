# Guía de Contribución

¡Gracias por tu interés en contribuir a este proyecto de arquitectura de microservicios! Esta guía te ayudará a configurar el entorno de desarrollo y a entender el proceso de contribución.

## Código de Conducta

Este proyecto sigue un [Código de Conducta](CODE_OF_CONDUCT.md). Al participar en este proyecto, aceptas cumplir con sus términos.

## Configuración del Entorno de Desarrollo

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/your-username/api-microservices.git
   cd api-microservices
   ```

2. **Instalar dependencias**:
   ```bash
   npm run bootstrap
   ```

3. **Configurar variables de entorno**:
   ```bash
   cp .env.example .env
   ```
   Asegúrate de ajustar las variables según tu entorno.

4. **Iniciar servicios**:
   ```bash
   docker-compose up -d
   ```

5. **Ejecutar en modo desarrollo**:
   ```bash
   npm run dev
   ```

## Estructura del Proyecto

Antes de contribuir, familiarízate con la estructura del proyecto:

- `gateway/` - API Gateway que maneja autenticación y enrutamiento
- `services/` - Microservicios individuales
- `shared-lib/` - Código compartido entre servicios
- `infrastructure/` - Configuración de infraestructura y despliegue

## Flujo de Trabajo para Contribuciones

1. **Crear una rama para tu cambio**:
   ```bash
   git checkout -b feature/tu-nueva-funcionalidad
   ```

2. **Realizar cambios y pruebas**:
   - Sigue las convenciones de código del proyecto
   - Añade pruebas para nuevas funcionalidades
   - Asegúrate de que todas las pruebas pasen

3. **Commits**:
   - Utiliza mensajes de commit descriptivos
   - Sigue la convención de [Conventional Commits](https://www.conventionalcommits.org/)
   - Ejemplo: `feat: añadir autenticación con Google OAuth`

4. **Verificar calidad del código**:
   ```bash
   npm run lint
   npm run test
   ```

5. **Enviar Pull Request**:
   - Sube tu rama al repositorio: `git push origin feature/tu-nueva-funcionalidad`
   - Abre un Pull Request desde GitHub
   - Describe detalladamente los cambios realizados

## Pautas de Estilo de Código

- Sigue el estilo definido en las configuraciones de ESLint y Prettier
- Mantén el código simple y legible
- Documenta APIs y funciones complejas
- Usa nombres descriptivos para variables y funciones

## Revisión de Código

- Todos los Pull Requests serán revisados por al menos un mantenedor
- Los comentarios y sugerencias deben abordarse antes de la aprobación
- Las revisiones son una oportunidad para mejorar la calidad del código

## Reportar Bugs

Si encuentras un bug, por favor reporta un issue en GitHub con:

- **Título**: Descripción clara y concisa del problema
- **Pasos para reproducir**: Instrucciones detalladas
- **Comportamiento esperado**: Lo que debería ocurrir
- **Comportamiento actual**: Lo que ocurre actualmente
- **Entorno**: Sistema operativo, versión de Node.js, etc.
- **Capturas de pantalla**: Si aplica

## Solicitar Nuevas Funcionalidades

Las solicitudes de nuevas funcionalidades son bienvenidas. Proporciona:

- Una descripción clara de la funcionalidad
- Justificación de su inclusión
- Posibles enfoques de implementación

## Comunicación

Para cualquier pregunta relacionada con el desarrollo, puedes:

- Abrir una discusión en GitHub
- Contactar a los mantenedores principales

---

¡Gracias por contribuir a este proyecto!