export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Banquetes Digitales API",
    version: "1.0.0",
    description: "API para crear, revisar y aprobar solicitudes de reservacion.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Servidor local",
    },
  ],
  tags: [
    { name: "Client", description: "Operaciones publicas para clientes" },
    { name: "Admin", description: "Operaciones protegidas del administrador" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      CreateReservationRequest: {
        type: "object",
        required: [
          "client_full_name",
          "email",
          "phone",
          "event_date_time",
          "guest_count",
          "event_address",
          "services_ids",
        ],
        properties: {
          client_full_name: { type: "string", example: "Carlos Mendoza Ruiz" },
          email: {
            type: "string",
            format: "email",
            example: "carlos@example.com",
          },
          phone: { type: "string", example: "+529991234567" },
          event_date_time: {
            type: "string",
            format: "date-time",
            example: "2026-11-20T19:00:00Z",
          },
          guest_count: { type: "integer", minimum: 1, example: 120 },
          event_address: { type: "string", example: "Colonia Chuburna C.45" },
          services_ids: {
            type: "array",
            items: { type: "integer", example: 1 },
            example: [1, 2, 4],
          },
        },
      },
      ReservationCreated: {
        type: "object",
        required: ["data"],
        properties: {
          data: {
            type: "object",
            required: ["folio"],
            properties: { folio: { type: "string", example: "BD-2026-00001" } },
          },
        },
      },
      Service: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          nombre: { type: "string", example: "Banquetes y bebidas" },
        },
      },
      RequestSummary: {
        type: "object",
        properties: {
          folio: { type: "string", example: "BD-2026-00001" },
          client_name: { type: "string", example: "Andrea Morales" },
          client_email: {
            type: "string",
            format: "email",
            example: "andrea@gmail.com",
          },
          requested_date: { type: "string", format: "date-time" },
          selected_services: { type: "array", items: { type: "string" } },
          status: { type: "string", enum: ["Pendiente", "Aprobada"] },
        },
      },
      RequestList: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/RequestSummary" },
          },
          pagination: {
            type: "object",
            properties: {
              total_records: { type: "integer", example: 3 },
              page: { type: "integer", example: 1 },
              per_page: { type: "integer", example: 10 },
            },
          },
        },
      },
      RequestDetail: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              folio: { type: "string", example: "BD-2026-00001" },
              client_name: { type: "string", example: "Andrea Morales" },
              client_email: { type: "string", format: "email" },
              client_phone: { type: "string" },
              guest_count: { type: "integer", example: 120 },
              requested_date: { type: "string", format: "date-time" },
              submission_date: { type: "string", format: "date-time" },
              selected_services: { type: "array", items: { type: "string" } },
              status: { type: "string", enum: ["Pendiente", "Aprobada"] },
            },
          },
        },
      },
      ApprovalRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["Aprobado", "Aprobada"],
            example: "Aprobado",
          },
        },
      },
      ApprovalResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              id: { type: "integer", example: 1 },
              folio: { type: "string", example: "BD-2026-00001" },
              status: { type: "string", enum: ["Pendiente", "Aprobada"] },
            },
          },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string", example: "Unauthorized" } },
      },
    },
  },
  paths: {
    "/api/client/request": {
      post: {
        tags: ["Client"],
        summary: "Crear una solicitud de reservacion",
        operationId: "createReservationRequest",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateReservationRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Solicitud creada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReservationCreated" },
              },
            },
          },
          "400": {
            description: "Solicitud invalida",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/client/services": {
      get: {
        tags: ["Client"],
        summary: "Listar servicios disponibles",
        operationId: "listServices",
        responses: {
          "200": {
            description: "Servicios disponibles",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Service" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/requests": {
      get: {
        tags: ["Admin"],
        summary: "Listar solicitudes",
        operationId: "listReservationRequests",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "per_page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 10 },
          },
        ],
        responses: {
          "200": {
            description: "Solicitudes paginadas",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RequestList" },
              },
            },
          },
          "401": {
            description: "Token ausente o invalido",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "403": {
            description: "El usuario no es administrador",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/admin/requests/{id}": {
      get: {
        tags: ["Admin"],
        summary: "Consultar el detalle de una solicitud",
        operationId: "getReservationRequest",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
          },
        ],
        responses: {
          "200": {
            description: "Detalle de la solicitud",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RequestDetail" },
              },
            },
          },
          "401": { description: "Token ausente o invalido" },
          "404": {
            description: "Solicitud no encontrada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Admin"],
        summary: "Aprobar una solicitud",
        operationId: "approveReservationRequest",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApprovalRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Solicitud aprobada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApprovalResponse" },
              },
            },
          },
          "400": {
            description: "Estado invalido",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": { description: "Token ausente o invalido" },
          "404": { description: "Solicitud no encontrada" },
        },
      },
    },
  },
} as const;
