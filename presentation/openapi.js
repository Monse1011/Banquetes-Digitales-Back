const resourceIdParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer" },
};

const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Banquetes Digitales Authentication API",
    version: "1.0.0",
    description: "API de autenticación y recuperación de contraseña",
  },
  servers: [{ url: "http://localhost:3000", description: "Development server" }],
  paths: {
    "/api/calendar": {
      get: {
        summary: "Consulta el calendario",
        tags: ["Calendar"],
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "date", in: "query", schema: { type: "string", format: "date" } },
          { name: "include_cancelled", in: "query", schema: { type: "boolean" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "per_page", in: "query", schema: { type: "integer", minimum: 1 } }
        ],
        responses: { 200: { description: "Lista de eventos" } }
      },
      post: {
        summary: "Agenda un evento",
        tags: ["Calendar"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { request_id: { type: "integer" } } } } }
        },
        responses: { 201: { description: "Evento agendado" } }
      }
    },
    "/api/calendar/{id}": {
      put: {
        summary: "Edita un evento",
        tags: ["Calendar"],
        security: [{ cookieAuth: [] }],
        parameters: [resourceIdParameter],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { start_at: { type: "string", format: "date-time" }, end_at: { type: "string", format: "date-time" }, location: { type: "string" } } } } }
        },
        responses: { 200: { description: "Evento editado" } }
      },
      delete: {
        summary: "Cancela un evento",
        tags: ["Calendar"],
        security: [{ cookieAuth: [] }],
        parameters: [resourceIdParameter],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { confirmed: { type: "boolean" } } } } }
        },
        responses: { 200: { description: "Evento cancelado" } }
      }
    },
    "/api/calendar/{id}/sync": {
      post: {
        summary: "Reintenta sincronizar un evento",
        tags: ["Calendar"],
        security: [{ cookieAuth: [] }],
        parameters: [resourceIdParameter],
        responses: { 200: { description: "Sincronización reintentada" } }
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Authenticate a user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["employeeId", "password"],
                properties: {
                  employeeId: { type: "string" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Authenticated" },
          401: { description: "Invalid credentials" },
        },
      },
    },
    "/api/auth/first-access": {
      get: {
        tags: ["Authentication"],
        summary: "Check first access",
        security: [{ CookieAuth: [] }],
        responses: {
          200: { description: "First access status" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/api/auth/change-password": {
      post: {
        tags: ["Authentication"],
        summary: "Change password",
        security: [{ CookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["password", "new_password"],
                properties: {
                  password: { type: "string", format: "password" },
                  new_password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Password changed" },
          400: { description: "Invalid password" },
        },
      },
    },
    "/api/auth/forgot-password": {
      post: {
        tags: ["Password reset"],
        summary: "Request a password reset",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: { email: { type: "string", format: "email" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Reset request processed" },
          400: { description: "Invalid request" },
        },
      },
    },
    "/api/auth/reset-password": {
      post: {
        tags: ["Password reset"],
        summary: "Reset a password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "new_password"],
                properties: {
                  token: { type: "string" },
                  new_password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Password reset" },
          400: { description: "Invalid reset request" },
        },
      },
    },
    "/api/client/request": {
      post: {
        tags: ["Client"],
        summary: "Create a reservation request",
        responses: {
          201: { description: "Reservation request created" },
          422: { description: "Validation error" },
        },
      },
    },
    "/api/client/services": {
      get: {
        tags: ["Client"],
        summary: "List available services",
        responses: { 200: { description: "Services list" } },
      },
    },
    "/api/admin/requests": {
      get: {
        tags: ["Admin", "Event assignment"],
        summary: "List reservation requests (RF-1.2.4.8 pending assignment with status=APPROVED)",
        security: [{ CookieAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["PENDING", "APPROVED", "ASSIGNED"] },
          },
          { name: "page", in: "query", required: false, schema: { type: "integer" } },
          { name: "per_page", in: "query", required: false, schema: { type: "integer" } },
        ],
        responses: {
          200: { description: "Requests list" },
          400: { description: "Invalid status filter" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/api/admin/requests/{id}": {
      get: {
        tags: ["Admin", "Event assignment"],
        summary: "Get a reservation request with its assigned logistic user (RF-1.2.4.2/9)",
        security: [{ CookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Request details" }, 404: { description: "Not found" } },
      },
      patch: {
        tags: ["Admin"],
        summary: "Approve a reservation request",
        security: [{ CookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Request approved" },
          400: { description: "Invalid request" },
        },
      },
    },
    "/api/admin/requests/{id}/assignment": {
      patch: {
        tags: ["Event assignment"],
        summary: "Assign or reassign the logistic user of a request (Función 2.4)",
        security: [{ CookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["data"],
                properties: {
                  data: {
                    type: "object",
                    required: ["user_id"],
                    properties: {
                      user_id: { type: "integer" },
                      request_id: {
                        type: "integer",
                        nullable: true,
                        description:
                          "Responsable actual esperado (concurrencia optimista, RF-1.2.4.7)",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Request assigned or reassigned" },
          400: { description: "Invalid user identifiers" },
          404: { description: "Request not found" },
          409: {
            description:
              "Status not reassignable (Confirmado), the current responsible changed (La solicitud ya fue asignada.) or logistic user not available (includes conflict when caused by overlap)",
          },
        },
      },
    },
    "/api/admin/users/usersavailable": {
      get: {
        tags: ["Event assignment"],
        summary: "List active Personal de Logística users for assignment (RF-1.2.4.10)",
        security: [{ CookieAuth: [] }],
        responses: { 200: { description: "Available users" } },
      },
    },
  },
  components: {
    securitySchemes: {
      CookieAuth: { type: "apiKey", in: "cookie", name: "auth_token" },
    },
  },
};
module.exports = { openApiDocument };
