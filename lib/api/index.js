const express = require('express');
const format = require('date-fns/format');
const { check, oneOf, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const app = express();
const bodyParser = require('body-parser').urlencoded({ extended: false });
const { GitHubAPI } = require('../config/github-api');

const { Installation, Subscription } = require('../models');
const verifyInstallation = require('../jira/verify-installation');
const logMiddleware = require('../middleware/log-middleware');
const JiraClient = require('../models/jira-client');
const { serializeSubscription, serializeJiraInstallation } = require('./serializers');

async function getInstallation(client, subscription) {
  const id = subscription.gitHubInstallationId;
  try {
    const response = await client.apps.getInstallation({ installation_id: id });
    response.data.syncStatus = subscription.syncStatus;
    return response.data;
  } catch (err) {
    return { error: err, id, deleted: err.status === 404 };
  }
}

function validViewerPermission(viewer) {
  switch (viewer.organization.repository.viewerPermission) {
    case 'WRITE':
    case 'ADMIN':
      return true;
    default:
      return false;
  }
}

/**
 * Finds the validation errors in this request and wraps them in an object with handy functions
 *
 * @param {import('express').Request} req - The incoming request.
 * @param {import('express').Response} res - The outgoing response.
 * @param {Function} next - The function to indicate that the request is not complete.
 */
function returnOnValidationError(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

const viewerPermissionQuery = `{
  viewer {
    login
    isEmployee
    organization(login: "github") {
      repository(name: "ce-extensibility") {
        viewerPermission
      }
    }
  }
}
`;

const limiter = rateLimit({
  store: new RedisStore({
    client: new Redis(process.env.REDIS_URL, { connectionName: 'express-rate-limit' }),
  }),
  windowMs: 60 * 1000, // 1 minutes
  max: 60, // limit each IP to 60 requests per windowMs
});

app.set('trust proxy', true);
app.use(limiter);
app.use(logMiddleware);


// All routes require a PAT to belong to someone on staff
// This middleware will take the token and make a request to GraphQL
// to see if it belongs to someone on staff

app.use(async (req, res, next) => {
  const token = req.get('Authorization');
  if (!token) return res.sendStatus(404);
  try {
    // Create a separate octokit instance than the one used by the app
    const octokit = GitHubAPI({
      auth: { token: token.split(' ')[1] },
    });
    const { data, errors } = (await octokit.request({
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      // 'viewer' will be the person that owns the token
      query: viewerPermissionQuery,
      url: '/graphql',
    })).data;

    req.addLogFields({ login: (data && data.viewer && data.viewer.login) });

    if (errors) {
      res.status(401);
      return res.json({ errors, viewerPermissionQuery });
    }

    if (!data.viewer.organization) {
      req.log.info(`Non-GitHub scoped token attempted to access staff routes: login=${data.viewer.login}, isEmployee=${data.viewer.isEmployee}`);

      res.status(401);
      return res.json({
        error: 'Unauthorized',
        message: 'Token provided does not have access to the `github` organization',
      });
    }

    if (!validViewerPermission(data.viewer)) {
      req.log.info(
        `User attempted to access staff routes: login=${data.viewer.login}, isEmployee=${data.viewer.isEmployee}, viewerPermission=${data.viewer.organization.repository.viewerPermission}`,
      );

      res.status(401);
      return res.json({
        error: 'Unauthorized',
        message: 'Token provided does not have `WRITE` or `ADMIN` access to the @github/ce-extensibility repo.',
      });
    }

    req.log.info(`Staff routes accessed: login=${data.viewer.login}, isEmployee=${data.viewer.isEmployee}, viewerPermission=${data.viewer.organization.repository.viewerPermission}`);

    next();
  } catch (err) {
    req.log.info({ err });

    if (err.status === 401) {
      res.status(401);
      return res.send(err.HttpError);
    }
    return res.sendStatus(500);
  }
});

app.get('/', (req, res) => {
  res.send({});
});
// This is invoked with stafftool
app.get('/:installationId', [
  check('installationId').isInt(),
  returnOnValidationError,
], async (req, res) => {
  const { Subscription } = require('../models');
  const { installationId } = req.params;
  const { client } = res.locals;
  try {
    const subscriptions = await Subscription.getAllForInstallation(installationId);
    if (!subscriptions.length) {
      return res.sendStatus(404);
    }
    const { jiraHost } = subscriptions[0].dataValues;
    const installations = await Promise.all(subscriptions.map(subscription => getInstallation(client, subscription)));
    const connections = installations
      .filter(response => !response.error)
      .map(data => ({
        ...data,
        isGlobalInstall: data.repository_selection === 'all',
        updated_at: format(data.updated_at, 'MMMM D, YYYY h:mm a'),
        syncState: data.syncState,
      }));

    const failedConnections = installations.filter(response => {
      req.log.error(response.error);
      return response.error;
    });
    res.json({
      host: jiraHost,
      installationId,
      connections,
      failedConnections,
      hasConnections: connections.length > 0 || failedConnections.length > 0,
      repoSyncState: `${req.protocol}://${req.get('host')}/api/${installationId}/repoSyncState.json`,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500);
    return res.json(err);
  }
});

app.get('/:installationId/repoSyncState.json', [
  check('installationId').isInt(),
  returnOnValidationError,
], async (req, res) => {
  const { Subscription } = require('../models');
  const { installationId } = req.params;
  const { jiraHost } = req.query;

  try {
    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId);
    if (!subscription) {
      return res.sendStatus(404);
    }
    const data = subscription.dataValues.repoSyncState;
    return res.json(data);
  } catch (err) {
    res.status(500);
    return res.json(err);
  }
});

app.post('/:installationId/sync', [
  bodyParser,
  check('installationId').isInt(),
  returnOnValidationError,
], async (req, res) => {
  const { Subscription } = require('../models');
  const { installationId } = req.params;
  req.log.info(req.body);
  const { jiraHost } = req.body;

  try {
    req.log.info(jiraHost, installationId);
    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId);
    if (!subscription) {
      return res.sendStatus(404);
    }

    const type = req.body.resetType || null;
    await Subscription.findOrStartSync(subscription, type);

    res.status(202);
    return res.json({
      message: `Successfully (re)started sync for ${installationId}`,
    });
  } catch (err) {
    req.log.info(err);
    return res.sendStatus(401);
  }
});

// Grab the last n failed syncs and trigger a sync
app.post('/resyncFailed', bodyParser, async (request, response) => {
  const maxLimit = 100;
  const defaultLimit = 10;
  const limit = Math.max(request.query.limit || defaultLimit, maxLimit);
  const offset = request.query.offset || 0;

  const failedSubscriptions = await Subscription.findAll(
    {
      where: { syncStatus: 'FAILED' },
      limit,
      offset,
      order: [['updatedAt', 'DESC']],
    },
  );

  await Promise.all(failedSubscriptions.map((subscription) => subscription.resumeSync()));

  const data = failedSubscriptions.map((subscription) => serializeSubscription(subscription));
  response.json(await Promise.all(data));
});

app.get('/jira/:clientKeyOrJiraHost', [
  bodyParser,
  oneOf([
    check('clientKeyOrJiraHost').isURL(),
    check('clientKeyOrJiraHost').isHexadecimal(),
  ]),
  returnOnValidationError,
], async (request, response) => {
  let jiraInstallations = [];

  if (request.params.clientKeyOrJiraHost.startsWith('http')) {
    jiraInstallations = await Installation.findAll({ where: { jiraHost: request.params.clientKeyOrJiraHost } });
  } else {
    jiraInstallations = await Installation.findAll({ where: { clientKey: request.params.clientKeyOrJiraHost } });
  }

  if (jiraInstallations.length > 0) {
    const data = jiraInstallations.map((jiraInstallation) => serializeJiraInstallation(jiraInstallation, request.log));
    response.json(await Promise.all(data));
  } else {
    response.sendStatus(404);
  }
});

app.post('/jira/:clientKey/uninstall', [
  bodyParser,
  check('clientKey').isHexadecimal(),
  returnOnValidationError,
], async (request, response) => {
  response.locals.installation = await Installation.findOne({ where: { clientKey: request.params.clientKey } });

  if (response.locals.installation) {
    const jiraClient = new JiraClient(response.locals.installation, request.log);
    const checkAuthorization = request.body.force !== 'true';

    if (checkAuthorization && await jiraClient.isAuthorized()) {
      response.status(400).json({ message: 'Refusing to uninstall authorized Jira installation' });
    } else {
      request.log.info(`Forcing uninstall for ${response.locals.installation.clientKey}`);

      const uninstall = require('../jira/uninstall');
      await uninstall(request, response);
    }
  } else {
    response.sendStatus(404);
  }
});

app.post('/jira/:installationId/verify', [
  bodyParser,
  check('installationId').isInt(),
  returnOnValidationError,
], async (req, response) => {
  const { installationId } = req.params;
  const installation = await Installation.findByPk(installationId);

  const respondWith = function (message) {
    const data = {
      message,
      installation: { enabled: installation.enabled, id: installation.id, jiraHost: installation.jiraHost },
    };

    return response.json(data);
  };

  if (installation.enabled) {
    respondWith('Installation already enabled');
  } else {
    await verifyInstallation(installation, req.log)();

    if (installation.enabled) {
      respondWith('Verification successful');
    } else {
      respondWith('Verification failed');
    }
  }
});

app.post('/:installationId/migrate/:undo?', [
  bodyParser,
  check('installationId').isInt(),
  returnOnValidationError,
], async (req, res) => {
  const { Subscription } = require('../models');
  const { installationId } = req.params;
  const { jiraHost } = req.body;
  const subscription = await Subscription.getSingleInstallation(jiraHost, installationId);

  if (!subscription) {
    return res.sendStatus(404);
  }

  const getJiraClient = require('../jira/client');
  const jiraClient = await getJiraClient(jiraHost, installationId, req.log);

  if (req.params.undo) {
    try {
      await jiraClient.devinfo.migration.undo();

      res.send('Successfully called migrationUndo');

      await subscription.update({ syncStatus: 'FAILED' });
      return;
    } catch (err) {
      res.send(`Error trying to undo migration: ${err}`).status(500);
    }
  } else {
    try {
      await jiraClient.devinfo.migration.complete();

      res.send('Successfully called migrationComplete');

      await subscription.update({ syncStatus: 'COMPLETE' });
      return;
    } catch (err) {
      res.send(`Error trying to complete migration: ${err}`).status(500);
    }
  }
});

app.get('/boom', (req, res, next) => { 'staff boom'.nopenope(); });
app.post('/boom', (req, res, next) => { 'staff boom'.nopenope(); });

module.exports = app;
