const { ReservationRequestStatus } = require("../domain/enums/reservation-request/request-status");

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

const calendarEventSchema = {
  type: "object",
  properties: {
    event_id: { type: "integer" },
    request_id: { type: "integer" },
    folio: { type: "string" },
    title: { type: "string" },
    logistics_responsible: {
      type: "object",
      nullable: true,
      properties: {
        user_id: { type: "integer" },
        full_name: { type: "string" },
      },
    },
    start_datetime: { type: "string", example: "2026-12-24 18:00:00" },
    end_datetime: { type: "string", example: "2026-12-24 23:00:00" },
    location: { type: "string" },
    status: { type: "string" },
    sync_status: { type: "string" },
  },
};

const calendarListResponse = {
  description: "Eventos del calendario",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              events: { type: "array", items: calendarEventSchema },
            },
          },
          metadata: {
            type: "object",
            properties: {
              pagination: {
                type: "object",
                properties: {
                  total_records: { type: "integer" },
                  page: { type: "integer" },
                  per_page: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
  },
};

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

const concurrencyConflictResponse = {
  409: { description: "The resource was changed by another operation; reload and retry" },
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
      responses: {
        204: { description: "Deactivated" },
        404: { description: "Not found" },
        ...concurrencyConflictResponse,
      },
    },
  };
}

// Función 3.2: la disponibilidad se calcula para el periodo del evento de la solicitud.
const requestIdQueryParameter = {
  name: "request_id",
  in: "query",
  schema: { type: "integer" },
  description:
    "Agrega available_quantity, assignment y metadata.request para la solicitud (RF-2.3.2.5)",
};

// RF-2.3.2.1 / RF-2.3.2.21
const resourceConfirmationAccessResponses = {
  403: { description: "Not the logistic user responsible for the request" },
  404: { description: "Request not found" },
  409: { description: "La solicitud no se encuentra en un estado que permita confirmar recursos." },
};

const observationsSchema = { type: "string", maxLength: 200, nullable: true };

function logisticsResourcePath(path, listParameters) {
  return {
    [`/api/logistics/resources/${path}`]: {
      get: {
        tags: ["Logistics"],
        summary: `List active ${path} resources (with request_id: availability for the event, Función 3.2)`,
        security: [{ CookieAuth: [] }],
        parameters: [
          ...listParameters.filter((parameter) => parameter.name !== "status"),
          requestIdQueryParameter,
        ],
        responses: {
          200: { description: "Paginated active resources" },
          ...resourceConfirmationAccessResponses,
        },
      },
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
          ...concurrencyConflictResponse,
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
          ...concurrencyConflictResponse,
          422: { description: "Validation error" },
        },
      },
      ...(softDelete ? softDeleteOperation(tag) : {}),
    },
    ...logisticsResourcePath(path, listParameters),
  };
}

const resourcePaths = {
  "/api/admin/resources/operative-roles": {
    get: {
      tags: ["Operative roles"],
      summary: "List active operative roles",
      security: [{ CookieAuth: [] }],
      responses: { 200: { description: "Active operative roles" } },
    },
    post: {
      tags: ["Operative roles"],
      summary: "Create an operative role",
      security: [{ CookieAuth: [] }],
      requestBody: jsonBody({
        type: "object",
        required: ["name"],
        properties: { name: { type: "string", minLength: 1, maxLength: 100 } },
      }),
      responses: {
        201: { description: "Created; the Location header has the new operative role path" },
        422: { description: "Validation error" },
      },
    },
  },
  "/api/admin/resources/operative-roles/{id}": {
    get: {
      tags: ["Operative roles"],
      summary: "Get an operative role",
      security: [{ CookieAuth: [] }],
      parameters: [resourceIdParameter],
      responses: {
        200: { description: "Operative role details" },
        404: { description: "Not found" },
      },
    },
    patch: {
      tags: ["Operative roles"],
      summary: "Edit an operative role name",
      security: [{ CookieAuth: [] }],
      parameters: [resourceIdParameter],
      requestBody: jsonBody({
        type: "object",
        required: ["name"],
        properties: { name: { type: "string", minLength: 1, maxLength: 100 } },
      }),
      responses: {
        204: { description: "Updated" },
        404: { description: "Not found" },
        422: { description: "Validation error" },
      },
    },
    delete: {
      tags: ["Operative roles"],
      summary: "Deactivate an operative role (logical delete)",
      security: [{ CookieAuth: [] }],
      parameters: [resourceIdParameter],
      responses: {
        204: { description: "Deactivated; existing resource associations are preserved" },
        404: { description: "Not found" },
      },
    },
  },
  "/api/admin/resources": {
    get: {
      tags: ["Resources"],
      summary: "List resources by type",
      security: [{ CookieAuth: [] }],
      parameters: [
        {
          name: "type",
          in: "query",
          schema: { type: "string", enum: ["HUMAN", "MATERIAL", "LOGISTIC"] },
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

const requestPathParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer" },
};

// Función 3.2 - Confirmación de recursos.
const resourceConfirmationPaths = {
  "/api/logistics/requests/{id}/resources": {
    post: {
      tags: ["Resource confirmation"],
      summary: "Register requested resources; sufficient ones are assigned provisionally",
      security: [{ CookieAuth: [] }],
      parameters: [requestPathParameter],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["data"],
              properties: {
                data: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    required: ["resource_id", "quantity"],
                    properties: {
                      resource_id: { type: "integer" },
                      quantity: { type: "integer", minimum: 1 },
                      usage_start: { type: "string", example: "2026-12-24 18:00:00" },
                      usage_end: { type: "string", example: "2026-12-24 23:00:00" },
                      observation: observationsSchema,
                    },
                  },
                },
                observations: observationsSchema,
              },
            },
          },
        },
      },
      responses: {
        204: { description: "Resources registered" },
        ...resourceConfirmationAccessResponses,
        409: {
          description:
            "Status does not allow confirming resources, or the availability changed (La disponibilidad del recurso cambió. Actualice la información.)",
        },
        422: { description: "Validation error" },
      },
    },
  },
  "/api/logistics/requests/{id}/resources/{resourceId}": {
    delete: {
      tags: ["Resource confirmation"],
      summary: "Remove a registered resource by releasing its provisional assignment",
      security: [{ CookieAuth: [] }],
      parameters: [
        requestPathParameter,
        { name: "resourceId", in: "path", required: true, schema: { type: "integer" } },
      ],
      responses: {
        204: { description: "Provisional assignment released" },
        ...resourceConfirmationAccessResponses,
        404: {
          description:
            "Request not found, or the resource has no provisional assignment in the request (El recurso no tiene una asignación provisional en la solicitud.)",
        },
      },
    },
  },
  "/api/logistics/requests/{id}/resources/confirm": {
    post: {
      tags: ["Resource confirmation"],
      summary: "Finish the confirmation (Coordinación Lista / Coordinación Incompleta)",
      security: [{ CookieAuth: [] }],
      parameters: [requestPathParameter],
      requestBody: {
        content: {
          "application/json": {
            schema: { type: "object", properties: { observations: observationsSchema } },
          },
        },
      },
      responses: {
        200: { description: "Confirmation saved" },
        400: { description: "A Suficiente resource is not assigned" },
        ...resourceConfirmationAccessResponses,
        409: { description: "Status does not allow confirming resources, or availability changed" },
        422: { description: "No resources registered or invalid observations" },
      },
    },
  },
  "/api/logistics/requests/{id}/resources/cancel": {
    post: {
      tags: ["Resource confirmation"],
      summary: "Discard provisional assignments and pending observations",
      security: [{ CookieAuth: [] }],
      parameters: [requestPathParameter],
      responses: {
        200: { description: "Provisional assignments released" },
        403: { description: "Not the logistic user responsible for the request" },
        404: { description: "Request not found" },
      },
    },
  },
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
    "/api/logistics/calendar/{id}/sync": {
      post: {
        summary: "Retry existing calendar synchronization (admin or responsible logistics user)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } },
        ],
        responses: {
          200: {
            description: "Attempt completed; data.sync_status reports synced or still pending",
          },
          401: { description: "Authentication required" },
          403: { description: "Not the responsible user or administrator" },
          404: { description: "Event not found" },
          422: { description: "Invalid event ID" },
        },
      },
    },
    "/api/logistics/calendar": {
      get: {
        summary: "Consulta el calendario del responsable de logística",
        tags: ["Calendar"],
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "date", in: "query", schema: { type: "string", format: "date" } }],
        responses: { 200: calendarListResponse },
      },
    },
    "/api/admin/calendar": {
      get: {
        summary: "Consulta el calendario del Administrador General",
        tags: ["Calendar"],
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "date", in: "query", schema: { type: "string", format: "date" } }],
        responses: { 200: calendarListResponse },
      },
    },
    "/api/logistics/requests/{id}/calendar": {
      post: {
        summary: "Agenda un evento desde una solicitud",
        tags: ["Calendar"],
        security: [{ cookieAuth: [] }],
        parameters: [resourceIdParameter],
        responses: {
          201: {
            description: "Evento agendado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        event_id: { type: "integer" },
                        request_id: { type: "integer" },
                        status: { type: "string" },
                        sync_status: { type: "string" },
                        google_event_id: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/logistics/calendar/{id}": {
      patch: {
        summary: "Edita un evento confirmado",
        tags: ["Calendar"],
        security: [{ cookieAuth: [] }],
        parameters: [resourceIdParameter],
        requestBody: jsonBody({
          type: "object",
          properties: {
            location: { type: "string" },
            start_datetime: { type: "string", example: "2026-12-24 19:00:00" },
            end_datetime: { type: "string", example: "2026-12-25 00:00:00" },
            logistic_user_id: { type: "integer", description: "Campo inmutable." },
            resources: {
              type: "array",
              description: "Campo inmutable.",
              items: { type: "object" },
            },
          },
        }),
        responses: { 200: { description: "Body vacío" } },
      },
      delete: {
        summary: "Cancela un evento confirmado",
        tags: ["Calendar"],
        security: [{ cookieAuth: [] }],
        parameters: [resourceIdParameter],
        responses: { 200: { description: "Body vacío" } },
      },
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
    "/api/auth/session": {
      get: {
        tags: ["Authentication"],
        summary: "Restore the current session from its HttpOnly cookie",
        security: [{ CookieAuth: [] }],
        responses: {
          200: { description: "Public user profile and firstAccess flag; Cache-Control: no-store" },
          401: {
            description: "Missing, expired or invalid session; inactive or changed-role account",
          },
          500: { description: "Session verification unavailable; retry allowed" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Authentication"],
        summary: "Expire the authentication cookie, including an already expired session",
        responses: { 204: { description: "HttpOnly cookie cleared" } },
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
            schema: { type: "string", enum: Object.keys(ReservationRequestStatus) },
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
    ...resourcePaths,
    ...resourceConfirmationPaths,
    "/api/logistics/requests/{id}": {
      get: {
        tags: ["Proposals"],
        summary: "Request detail with client contact data and assigned resources (RF-2.3.4.1)",
        security: [{ CookieAuth: [] }],
        parameters: [resourceIdParameter],
        responses: {
          200: { description: "Agreements form preloaded" },
          404: { description: "Request not found or not owned by the user" },
        },
      },
    },
    "/api/logistics/requests/{id}/derived-information": {
      post: {
        tags: ["Proposals"],
        summary: "Save client agreements without changing the request status (RF-2.3.4.11)",
        security: [{ CookieAuth: [] }],
        parameters: [resourceIdParameter],
        requestBody: jsonBody({
          type: "object",
          required: ["location", "start_datetime", "end_datetime", "adjusted_resources"],
          properties: {
            location: { type: "string", maxLength: 255 },
            start_datetime: { type: "string", format: "date-time" },
            end_datetime: { type: "string", format: "date-time" },
            observations: { type: "string" },
            adjusted_resources: {
              type: "array",
              description:
                "Incluye materiales y recursos logísticos actualmente asignados. Para personal, incluye las personas seleccionadas; se pueden agregar personas humanas activas disponibles, y omitir una persona confirmada la libera. Cantidad 0 libera una asignación; una persona nueva requiere cantidad 1.",
              items: {
                type: "object",
                required: ["resource_id", "quantity"],
                properties: {
                  resource_id: { type: "integer" },
                  quantity: { type: "integer", minimum: 0 },
                },
              },
            },
          },
        }),
        responses: {
          201: { description: "Agreements saved" },
          400: { description: "Required fields missing" },
          404: { description: "Request not found or not owned by the user" },
          409: { description: "Invalid state or availability exceeded" },
        },
      },
    },
    "/api/logistics/requests/{id}/proposals": {
      post: {
        tags: ["Proposals"],
        summary: "Generate the formal proposal PDF (RF-2.3.4.4)",
        security: [{ CookieAuth: [] }],
        parameters: [resourceIdParameter],
        requestBody: jsonBody({
          type: "object",
          required: ["derived_information_id"],
          properties: {
            derived_information_id: { type: "integer" },
            client_observations: { type: "string" },
          },
        }),
        responses: {
          201: { description: "Proposal generated and request moved to Propuesta generada" },
          400: { description: "Required fields missing" },
          404: { description: "Agreements not found for the request" },
          409: { description: "Invalid state or proposal already generated" },
          500: { description: "PDF generation failed; status unchanged" },
        },
      },
      get: {
        tags: ["Proposals"],
        summary: "Get the generated proposal of the request (RF-2.3.4.6)",
        security: [{ CookieAuth: [] }],
        parameters: [resourceIdParameter],
        responses: {
          200: { description: "Proposal data with pdf_url" },
          404: { description: "Proposal not found or not visible in current status" },
        },
      },
    },
    "/api/logistics/requests/{id}/proposals/download": {
      get: {
        tags: ["Proposals"],
        summary: "Download the immutable proposal PDF (RF-2.3.4.6)",
        security: [{ CookieAuth: [] }],
        parameters: [resourceIdParameter],
        responses: {
          200: { description: "PDF file", content: { "application/pdf": {} } },
          404: { description: "Proposal not found" },
        },
      },
    },
    "/api/logistics/requests/{id}/proposals/send": {
      post: {
        tags: ["Proposals"],
        summary: "Send the proposal PDF to the client email (RF-2.3.4.6)",
        security: [{ CookieAuth: [] }],
        parameters: [resourceIdParameter],
        responses: {
          200: { description: "Proposal sent" },
          404: { description: "Proposal not found" },
          500: { description: "Email sending failed" },
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
    "/api/admin/users/{id}/credentials": {
      post: {
        tags: ["User management"],
        summary:
          "Resend credentials: new temporary password, previous one invalidated (RF-1.2.12.3)",
        security: [{ CookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          204: { description: "Credentials resent" },
          404: { description: "User not found" },
          409: { description: "User inactive or already defined their password" },
          502: { description: "The email with the temporary password could not be sent" },
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
