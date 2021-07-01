const bodyParser = require('body-parser');
const Sentry = require('@sentry/node');

const { Installation } = require('../models');
const { hasValidJwt } = require('./util/jwt');
const logMiddleware = require('../middleware/log-middleware');

const connect = require('./connect');
const disable = require('./disable');
const enable = require('./enable');
const install = require('./install');
const uninstall = require('./uninstall');

const authenticate = async (req, res, next) => {
  const installation = await Installation.getForClientKey(req.body.clientKey);
  if (!installation) {
    res.status(404).json({});
    return;
  }

  const { jiraHost, sharedSecret, clientKey } = installation;

  req.addLogFields({ jiraHost, jiraClientKey: clientKey });
  res.locals.installation = installation;

  if (hasValidJwt(sharedSecret, jiraHost, req, res)) {
    next();
  }
};

module.exports = (robot, { getRouter }) => {
  const router = getRouter('/jira');

  // The request handler must be the first middleware on the app
  router.use(Sentry.Handlers.requestHandler());
  router.use(bodyParser.json());
  router.use(logMiddleware);

  // Set up event handlers
  router.get('/atlassian-connect.json', connect);
  router.post('/events/disabled', authenticate, disable);
  router.post('/events/enabled', authenticate, enable);
  router.post('/events/installed', install); // we can't authenticate since we don't have the secret
  router.post('/events/uninstalled', authenticate, uninstall);

  if (process.env.EXCEPTION_DEBUG_MODE || process.env.NODE_ENV === 'development') {
    router.get('/boom', (req, res, next) => { 'jira boom'.nopenope(); });
    router.post('/boom', (req, res, next) => { 'jira boom'.nopenope(); });
  }

  // The error handler must come after controllers and before other error middleware
  router.use(Sentry.Handlers.errorHandler());
};
