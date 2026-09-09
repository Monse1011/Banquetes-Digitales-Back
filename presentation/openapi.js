const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Banquetes Digitales API",
    version: "1.0.0",
    description: "API para reservas de banquetes",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Development server",
    },
  ],
  paths: {
    "/api/client/request": {
      post: {
        tags: ["Client"],
        summary: "Create a new reservation request",
        operationId: "createReservationRequest",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
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
                  client_full_name: {
                    type: "string",
                  },
                  email: {
                    type: "string",
                    format: "email",
                  },
                  phone: {
                    type: "string",
                  },
                  event_date_time: {
                    type: "string",
                    format: "date-time",
                  },
                  guest_count: {
                    type: "integer",
                    minimum: 1,
                  },
                  event_address: {
                    type: "string",
                  },
                  services_ids: {
                    type: "array",
                    items: {
                      type: "integer",
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Reservation request created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        folio: {
                          type: "string",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          422: {
            description: "Validation error, one message per invalid field",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    errors: {
                      type: "object",
                      description:
                        "Keys match the request body fields (e.g. client_full_name, email, phone, event_date_time, guest_count, event_address, services_ids)",
                      additionalProperties: {
                        type: "string",
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
    "/api/client/services": {
      get: {
        tags: ["Client"],
        summary: "List available services",
        operationId: "listServices",
        responses: {
          200: {
            description: "Services list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: {
                            type: "integer",
                          },
                          nombre: {
                            type: "string",
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
      },
    },
    "/api/admin/requests": {
      get: {
        tags: ["Admin"],
        summary: "List all reservation requests",
        operationId: "listRequests",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: {
              type: "integer",
              default: 1,
            },
          },
          {
            name: "per_page",
            in: "query",
            schema: {
              type: "integer",
              default: 10,
            },
          },
        ],
        responses: {
          200: {
            description: "Requests list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          folio: {
                            type: "string",
                          },
                          client_name: {
                            type: "string",
                          },
                          client_email: {
                            type: "string",
                          },
                          requested_date: {
                            type: "string",
                            format: "date-time",
                          },
                          selected_services: {
                            type: "array",
                            items: {
                              type: "string",
                            },
                          },
                          status: {
                            type: "string",
                          },
                        },
                      },
                    },
                    pagination: {
                      type: "object",
                      properties: {
                        total_records: {
                          type: "integer",
                        },
                        page: {
                          type: "integer",
                        },
                        per_page: {
                          type: "integer",
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
    },
    "/api/admin/requests/{id}": {
      get: {
        tags: ["Admin"],
        summary: "Get a specific reservation request",
        operationId: "getRequest",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "integer",
            },
          },
        ],
        responses: {
          200: {
            description: "Request details",
          },
        },
      },
      patch: {
        tags: ["Admin"],
        summary: "Approve a reservation request",
        operationId: "approveRequest",
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "integer",
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    enum: ["Aprobada"],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Request approved",
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
      },
    },
  },
};

module.exports = { openApiDocument };
