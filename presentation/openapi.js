const resourceIdParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer" },
};

const humanResourceListParameters = [
  { name: "status", in: "query", schema: { type: "string", enum: ["active", "inactive"] } },
  { name: "name", in: "query", schema: { type: "string" } },
  { name: "operative_role_id", in: "query", schema: { type: "integer" } },
  { name: "sort_by", in: "query", schema: { type: "string", enum: ["name"] } },
  { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
  { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
  { name: "per_page", in: "query", schema: { type: "integer", minimum: 1 } },
];

// El contrato del DAD envuelve los campos del body en "data".
function dataEnvelope(schema) {
  return { type: "object", required: ["data"], properties: { data: schema } };
}

const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Banquetes Digitales Authentication API",
    version: "1.0.0",
    description: "API de autenticación y recuperación de contraseña",
  },
  servers: [{ url: "http://localhost:3000", description: "Development server" }],
  paths: {
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
        tags: ["Admin"],
        summary: "List reservation requests",
        security: [{ CookieAuth: [] }],
        responses: { 200: { description: "Requests list" }, 403: { description: "Forbidden" } },
      },
    },
    "/api/admin/requests/{id}": {
      get: {
        tags: ["Admin"],
        summary: "Get a reservation request",
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
    "/api/admin/resources/human": {
      get: {
        tags: ["Human resources"],
        summary: "List human resources (RF-1.2.8.4 / RF-1.2.8.5)",
        security: [{ CookieAuth: [] }],
        parameters: humanResourceListParameters,
        responses: { 200: { description: "Paginated human resources" } },
      },
      post: {
        tags: ["Human resources"],
        summary: "Register a human resource (RF-1.2.8.1 / RF-1.2.8.7)",
        security: [{ CookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: dataEnvelope({
                type: "object",
                required: ["name", "operative_role_id"],
                properties: {
                  name: { type: "string", maxLength: 100 },
                  operative_role_id: { type: "integer" },
                  confirm_duplicate: {
                    type: "boolean",
                    description: "Send true to register a possible duplicate after the warning",
                  },
                },
              }),
            },
          },
        },
        responses: {
          201: {
            description: "Created; the Location header has the new resource path",
          },
          409: { description: "Possible duplicate; requires_confirmation is true" },
          422: { description: "Validation error" },
        },
      },
    },
    "/api/admin/resources/human/{id}": {
      get: {
        tags: ["Human resources"],
        summary: "Get a human resource (RF-1.2.8.6)",
        security: [{ CookieAuth: [] }],
        parameters: [resourceIdParameter],
        responses: {
          200: { description: "Human resource details" },
          404: { description: "Not found" },
        },
      },
      patch: {
        tags: ["Human resources"],
        summary: "Edit name and operative role (RF-1.2.8.2)",
        security: [{ CookieAuth: [] }],
        parameters: [resourceIdParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: dataEnvelope({
                type: "object",
                required: ["name", "operative_role_id"],
                properties: {
                  name: { type: "string", maxLength: 100 },
                  operative_role_id: { type: "integer" },
                },
              }),
            },
          },
        },
        responses: {
          204: { description: "Updated" },
          404: { description: "Not found" },
          422: { description: "Validation error" },
        },
      },
      put: {
        tags: ["Human resources"],
        summary: "Deactivate (logical delete) or reactivate (RF-1.2.8.3)",
        security: [{ CookieAuth: [] }],
        parameters: [resourceIdParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: dataEnvelope({
                type: "object",
                required: ["is_active"],
                properties: { is_active: { type: "boolean" } },
              }),
            },
          },
        },
        responses: {
          204: { description: "Status changed" },
          404: { description: "Not found" },
          422: { description: "Validation error" },
        },
      },
    },
    "/api/logistics/resources/human": {
      get: {
        tags: ["Logistics"],
        summary: "List active human resources (RF-1.2.8.9)",
        security: [{ CookieAuth: [] }],
        parameters: humanResourceListParameters.filter((parameter) => parameter.name !== "status"),
        responses: {
          200: { description: "Paginated active human resources" },
          403: { description: "Forbidden" },
        },
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
