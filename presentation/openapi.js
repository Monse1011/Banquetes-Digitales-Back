const resourceIdParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer" },
};

const resourceListParameters = [
  { name: "status", in: "query", schema: { type: "string", enum: ["active", "inactive"] } },
  { name: "name", in: "query", schema: { type: "string" } },
  { name: "operative_role_id", in: "query", schema: { type: "integer" } },
  { name: "sort_by", in: "query", schema: { type: "string", enum: ["name"] } },
  { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
  { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
  { name: "per_page", in: "query", schema: { type: "integer", minimum: 1 } },
];

// El rol operativo solo existe en los recursos humanos.
const inventoryListParameters = resourceListParameters.filter(
  (parameter) => parameter.name !== "operative_role_id"
);

// El contrato del DAD envuelve los campos del body en "data".
function dataEnvelope(schema) {
  return { type: "object", required: ["data"], properties: { data: schema } };
}

function jsonBody(schema) {
  return { required: true, content: { "application/json": { schema: dataEnvelope(schema) } } };
}

const humanResourceBody = {
  type: "object",
  required: ["name", "operative_role_id"],
  properties: {
    name: { type: "string", maxLength: 100 },
    operative_role_id: { type: "integer" },
  },
};

const inventoryResourceBody = {
  type: "object",
  required: ["name", "quantity", "unit_cost"],
  properties: {
    name: { type: "string", maxLength: 100 },
    quantity: { type: "integer", minimum: 0 },
    unit_cost: { type: "number", minimum: 0 },
  },
};

const duplicateWarningResponse = {
  409: { description: "Possible duplicate; requires_confirmation is true" },
};

function softDeleteOperation(tag) {
  return {
    delete: {
      tags: [tag],
      summary: "Soft delete a resource",
      security: [{ CookieAuth: [] }],
      parameters: [resourceIdParameter],
      responses: { 204: { description: "Deactivated" }, 404: { description: "Not found" } },
    },
  };
}

// Rutas de las Funciones 2.8 (human), 2.9 (material) y 2.10 (logistic).
function resourceTypePaths(path, tag, createBody, updateBody, { softDelete = false } = {}) {
  const security = [{ CookieAuth: [] }];
  const listParameters = path === "human" ? resourceListParameters : inventoryListParameters;
  const statusBody = {
    type: "object",
    required: ["is_active"],
    properties: { is_active: { type: "boolean" } },
  };

  return {
    [`/api/admin/resources/${path}`]: {
      get: {
        tags: [tag],
        summary: "List resources (active by default, sorted by name)",
        security,
        parameters: listParameters,
        responses: { 200: { description: "Paginated resources" } },
      },
      post: {
        tags: [tag],
        summary: "Register a resource",
        security,
        requestBody: jsonBody(createBody),
        responses: {
          201: { description: "Created; the Location header has the new resource path" },
          ...(createBody.properties.confirm_duplicate ? duplicateWarningResponse : {}),
          422: { description: "Validation error" },
        },
      },
    },
    [`/api/admin/resources/${path}/{id}`]: {
      get: {
        tags: [tag],
        summary: "Get a resource",
        security,
        parameters: [resourceIdParameter],
        responses: { 200: { description: "Resource details" }, 404: { description: "Not found" } },
      },
      patch: {
        tags: [tag],
        summary: "Edit a resource",
        security,
        parameters: [resourceIdParameter],
        requestBody: jsonBody(updateBody),
        responses: {
          204: { description: "Updated" },
          404: { description: "Not found" },
          422: { description: "Validation error" },
        },
      },
      put: {
        tags: [tag],
        summary: "Deactivate (logical delete) or reactivate",
        security,
        parameters: [resourceIdParameter],
        requestBody: jsonBody(statusBody),
        responses: {
          204: { description: "Status changed" },
          404: { description: "Not found" },
          422: { description: "Validation error" },
        },
      },
      ...(softDelete ? softDeleteOperation(tag) : {}),
    },
    [`/api/logistics/resources/${path}`]: {
      get: {
        tags: ["Logistics"],
        summary: `List active ${path} resources`,
        security,
        parameters: listParameters.filter((parameter) => parameter.name !== "status"),
        responses: { 200: { description: "Paginated active resources" } },
      },
    },
  };
}

const resourcePaths = {
  "/api/admin/resources": {
    get: {
      tags: ["Resources"],
      summary: "List resources by type",
      security: [{ CookieAuth: [] }],
      parameters: [
        {
          name: "type",
          in: "query",
          schema: { type: "string", enum: ["humano", "material", "logistico"] },
        },
        ...inventoryListParameters,
      ],
      responses: { 200: { description: "Paginated resources" } },
    },
  },
  ...resourceTypePaths(
    "human",
    "Human resources",
    {
      ...humanResourceBody,
      properties: {
        ...humanResourceBody.properties,
        confirm_duplicate: {
          type: "boolean",
          description: "Send true to register a possible duplicate after the 409 warning",
        },
      },
    },
    humanResourceBody
  ),
  ...resourceTypePaths(
    "material",
    "Material resources",
    inventoryResourceBody,
    inventoryResourceBody
  ),
  ...resourceTypePaths(
    "logistic",
    "Logistic resources",
    inventoryResourceBody,
    inventoryResourceBody,
    {
      softDelete: true,
    }
  ),
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
    ...resourcePaths,
  },
  components: {
    securitySchemes: {
      CookieAuth: { type: "apiKey", in: "cookie", name: "auth_token" },
    },
  },
};
module.exports = { openApiDocument };
