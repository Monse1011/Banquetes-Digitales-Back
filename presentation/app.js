const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { requireAdmin } = require('./middleware/admin-auth');
const { ReservationRequestController } = require('./controller/reservation-request-controller');
const { ServiceController } = require('./controller/service-controller');
const { openApiDocument } = require('./openapi');

function createApp(dependencies) {
  const app = express();
  const reservationRequestController = new ReservationRequestController(dependencies);
  const serviceController = new ServiceController(dependencies.serviceRepository);

  app.use(express.json());
  app.get('/api-docs.json', (_request, response) => {
    response.json(openApiDocument);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.post('/api/client/request', (request, response, next) => {
    reservationRequestController.create(request, response).catch(next);
  });
  app.get('/api/client/services', (request, response, next) => {
    serviceController.list(request, response).catch(next);
  });
  app.get('/api/admin/requests', requireAdmin, (request, response, next) => {
    reservationRequestController.list(request, response).catch(next);
  });
  app.get('/api/admin/requests/:id', requireAdmin, (request, response, next) => {
    reservationRequestController.getById(request, response).catch(next);
  });
  app.patch('/api/admin/requests/:id', requireAdmin, (request, response, next) => {
    reservationRequestController.approve(request, response).catch(next);
  });

  app.use((error, _request, response, _next) => {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Reservation request not found' ? 404 : 400;

    response.status(status).json({ error: message });
  });

  return app;
}

module.exports = {
  createApp
};
