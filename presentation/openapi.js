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
        responses: { 200: { description: "Authenticated" }, 401: { description: "Invalid credentials" } },
      },
    },
    "/api/auth/first-access": {
      get: {
        tags: ["Authentication"],
        summary: "Check first access",
        security: [{ CookieAuth: [] }],
        responses: { 200: { description: "First access status" }, 401: { description: "Unauthorized" } },
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
        responses: { 200: { description: "Password changed" }, 400: { description: "Invalid password" } },
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
        responses: { 200: { description: "Reset request processed" }, 400: { description: "Invalid request" } },
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
        responses: { 200: { description: "Password reset" }, 400: { description: "Invalid reset request" } },
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
        responses: { 200: { description: "Request approved" }, 400: { description: "Invalid request" } },
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
