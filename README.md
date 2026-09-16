# Banquetes Digitales - Authentication Backend

API backend para autenticación y recuperación de contraseñas. Construida con Node.js y Express.

## Requisitos

- Node.js v18 o superior
- PostgreSQL v12 o superior
- npm v8 o superior

## Instalación

1. Clonar el repositorio:

```bash
git clone https://github.com/Monse1011/Banquetes-Digitales-Back.git
cd Banquetes-Digitales-Back
```

2. Instalar dependencias:

```bash
npm install
```

3. Configurar variables de entorno:

```bash
cp .env.example .env
```

Actualizar los valores en `.env`:

```
PORT=3000
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=password
PGDATABASE=banquetes_db
JWT_SECRET=your-secret-key
DATABASE_URL=postgresql://user:password@localhost:5432/banquetes_db
```

4. Crear y ejecutar migraciones de base de datos:

```bash
psql -U postgres -d banquetes_db -f database.sql
```

## Desarrollo

Iniciar servidor en modo desarrollo con auto-reload:

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

## Testing

Ejecutar pruebas:

```bash
npm test
```

Ejecutar pruebas una sola vez:

```bash
npm run test:run
```

## Producción

Iniciar servidor:

```bash
npm start
```

## Estructura del Proyecto

```
├── domain/                 # Entidades y lógica de dominio, sin dependencias de otras capas
│   ├── entities/          # auth/, password-reset/
│   ├── enums/             # Constantes y enumeradores del negocio, por feature
│   ├── exceptions/        # Errores de dominio, por feature
│   └── value-objects/     # Email, Password (validación de conceptos sin entidad propia)
├── application/           # Casos de uso que orquestan la lógica de dominio
│   ├── use-cases/        # auth/, password-reset/
│   ├── dto/               # Entrada/salida de los casos de uso, por feature
│   ├── ports/              # Contratos con el mundo exterior que no son repositorios (email, tokens)
│   ├── repositories/       # Contratos de los repositorios, por feature
│   └── services/           # Lógica de aplicación
├── infrastructure/         # Implementaciones técnicas
│   ├── database/           # Configuración de conexión (postgres-pool)
│   ├── email/               # Implementación real de envío de correo
│   ├── repositories/        # Implementación real de los repositorios, por feature
│   ├── security/             # Hashing y JWT
│   └── services/              # Implementación de servicios externos, por feature
├── presentation/            # API HTTP
│   ├── controller/           # Controladores HTTP, por feature
│   ├── middleware/            # Autenticación, rate limiting
│   ├── routes/                 # Routers de Express
│   ├── app.js                  # Composición de la app Express
│   └── openapi.js              # Documento Swagger/OpenAPI
└── src/
    └── app.js                  # Punto de entrada: carga env, arma dependencias y arranca el server
```

## API Endpoints

### Autenticación

- **POST** `/api/auth/login` - Iniciar sesión
- **GET** `/api/auth/first-access` - Consultar primer acceso
- **POST** `/api/auth/change-password` - Cambiar contraseña
- **POST** `/api/auth/forgot-password` - Solicitar recuperación
- **POST** `/api/auth/reset-password` - Restablecer contraseña

## Documentación API

La documentación Swagger está disponible en `http://localhost:3000/api-docs`

## Tecnologías

- **Express.js** v5.2.1 - Framework web
- **PostgreSQL** - Base de datos
- **jsonwebtoken** - Autenticación JWT
- **Vitest** - Framework de testing
- **Node.js** - Runtime

## Arquitectura

El proyecto sigue Clean Architecture con 4 capas:

1. **Domain** - Lógica de negocio pura, sin dependencias
2. **Application** - Casos de uso que orquestan la lógica de dominio
3. **Infrastructure** - Implementaciones técnicas (bases de datos, librerías externas)
4. **Presentation** - API HTTP, controladores, middleware

## Base de Datos

La conexión se crea con `createPostgresPool` y acepta `DATABASE_URL` o las variables
`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` y `PGDATABASE`.

## Contribuir

1. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
2. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
3. Push a la rama (`git push origin feature/AmazingFeature`)
4. Abrir un Pull Request

## Licencia

ISC
