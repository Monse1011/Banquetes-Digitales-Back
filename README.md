# Banquetes Digitales - Backend

API backend para gestionar reservas de banquetes digitales. Construida con Node.js y Express.

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
├── domain/                 # Entidades y lógica de dominio
│   ├── entities/          # Cliente, Servicio, SolicitudReserva
│   ├── enums/             # Estados de solicitud
│   └── exceptions/        # Excepciones de dominio
├── application/           # Lógica de aplicación
│   ├── dto/              # Objetos de transferencia de datos
│   ├── use-cases/        # Casos de uso de negocio
│   ├── ports/            # Interfaces de puertos
│   ├── repositories/     # Interfaces de repositorio
│   └── services/         # Interfaces de servicio
├── infrastructure/        # Implementaciones técnicas
│   ├── database/         # Configuración de base de datos
│   ├── repositories/     # Implementaciones de repositorio
│   └── services/         # Implementaciones de servicio
├── presentation/         # API y controladores
│   ├── controller/       # Controladores HTTP
│   ├── middleware/       # Middleware de Express
│   └── app.js           # Configuración de Express
└── src/
    └── app.js           # Punto de entrada de la aplicación
```

## API Endpoints

### Cliente

- **POST** `/api/client/request` - Crear solicitud de reserva
- **GET** `/api/client/services` - Listar servicios disponibles

### Admin (requiere autenticación JWT)

- **GET** `/api/admin/requests` - Listar todas las solicitudes
- **GET** `/api/admin/requests/:id` - Obtener detalles de solicitud
- **PATCH** `/api/admin/requests/:id` - Aprobar solicitud

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

La infraestructura incluye `PostgresClientRepository`, `PostgresServiceRepository`
y `PostgresReservationRequestRepository`, compatibles con los puertos de
`application`. La conexión se crea con `createPostgresPool` y acepta
`DATABASE_URL` o las variables `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` y
`PGDATABASE`.

El esquema esperado es el definido en `database.sql`. Las operaciones de solicitudes
mantienen `reservations_request` y `request_services` dentro de una transacción.

El esquema de la base de datos se utiliza para mantener las entidades
`reservations_request` y `request_services` dentro de una transacción.
El arranque actual continúa usando in-memory; para producción se deben construir
los casos de uso con los repositorios PostgreSQL y cerrar el pool durante el
apagado del proceso.

## Contribuir

1. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
2. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
3. Push a la rama (`git push origin feature/AmazingFeature`)
4. Abrir un Pull Request

## Licencia

ISC
