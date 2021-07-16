const bodyParser = require('body-parser');
const express = require('express');
const path = require('path');
const session = require('cookie-session');
const csrf = require('csurf');
const Sentry = require('@sentry/node');
const hbs = require('hbs');

const oauth = require('./github-oauth')({
  githubClient: process.env.GITHUB_CLIENT_ID,
  githubSecret: process.env.GITHUB_CLIENT_SECRET,
  baseURL: process.env.APP_URL,
  loginURI: '/github/login',
  callbackURI: '/github/callback',
});

const getGitHubSetup = require('./get-github-setup');
const postGitHubSetup = require('./post-github-setup');
const getGitHubConfiguration = require('./get-github-configuration');
const postGitHubConfiguration = require('./post-github-configuration');
const listGitHubInstallations = require('./list-github-installations');
const getGitHubSubscriptions = require('./get-github-subscriptions');
const deleteGitHubSubscription = require('./delete-github-subscription');
const getJiraConfiguration = require('./get-jira-configuration');
const deleteJiraConfiguration = require('./delete-jira-configuration');

const getGithubClientMiddleware = require('./github-client-middleware');
const verifyJiraMiddleware = require('./verify-jira-middleware');

const retrySync = require('./retry-sync');

const api = require('../api');
const logMiddleware = require('../middleware/log-middleware');

const register = require('./post-ghae-register')({
  registerURI: '/register',
  callbackURI: '/ghaeRegisterComplete',
});

// setup route middlewares
const csrfProtection = csrf(
  process.env.NODE_ENV === 'test' ? {
    ignoreMethods: ['GET',
      'HEAD',
      'OPTIONS',
      'POST',
      'PUT'],
  } : undefined,
);

module.exports = (appTokenGenerator) => {
  const githubClientMiddleware = getGithubClientMiddleware(appTokenGenerator);

  const app = express();
  const rootPath = path.join(__dirname, '..', '..');

  // The request handler must be the first middleware on the app
  app.use(Sentry.Handlers.requestHandler());

  // Parse URL-encoded bodies for Jira configuration requests
  app.use(bodyParser.urlencoded({ extended: false }));

  // We run behind ngrok.io so we need to trust the proxy always
  app.set('trust proxy', true);

  app.use(session({
    keys: [process.env.GITHUB_CLIENT_SECRET],
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    signed: true,
    sameSite: 'none',
    secure: true,
  }));

  app.use(logMiddleware);

  app.set('view engine', 'hbs');
  app.set('views', path.join(rootPath, 'views'));

  // Handlebars helpers
  hbs.registerHelper('toLowerCase', (str) => str.toLowerCase());
  hbs.registerHelper('replaceSpaceWithHyphen', (str) => str.replace(/ /g, '-'));
  hbs.registerHelper('ifAllReposSynced', (numberOfSyncedRepos, totalNumberOfRepos) =>
    ((numberOfSyncedRepos === totalNumberOfRepos) ? totalNumberOfRepos : `${numberOfSyncedRepos} / ${totalNumberOfRepos}`));

  app.use('/public', express.static(path.join(rootPath, 'static')));
  app.use('/public/css-reset', express.static(path.join(rootPath, 'node_modules/@atlaskit/css-reset/dist')));
  app.use('/public/primer', express.static(path.join(rootPath, 'node_modules/primer/build')));
  app.use('/public/atlassian-ui-kit', express.static(path.join(rootPath, 'node_modules/@atlaskit/reduced-ui-pack/dist')));

  // Check to see if jira host has been passed to any routes and save it to session
  app.use((req, res, next) => {
    if (req.query.xdm_e) {
      req.session.jiraHost = req.query.xdm_e;
    }
    next();
  });

  app.use(githubClientMiddleware);

  app.use('/api', api);

  app.get('/github/setup', csrfProtection, oauth.checkGithubAuth, getGitHubSetup);
  app.post('/github/setup', csrfProtection, postGitHubSetup);

  app.get('/github/configuration', csrfProtection, oauth.checkGithubAuth, getGitHubConfiguration);
  app.post('/github/configuration', csrfProtection, postGitHubConfiguration);

  app.get('/github/installations', csrfProtection, oauth.checkGithubAuth, listGitHubInstallations);
  app.get('/github/subscriptions/:installationId', csrfProtection, getGitHubSubscriptions);
  app.post('/github/subscription', csrfProtection, deleteGitHubSubscription);

  app.get('/jira/configuration', csrfProtection, verifyJiraMiddleware, getJiraConfiguration);
  app.delete('/jira/configuration', verifyJiraMiddleware, deleteJiraConfiguration);
  app.post('/jira/sync', verifyJiraMiddleware, retrySync);

  app.get('/', async (req, res, next) => {
    const { data: info } = (await res.locals.client.apps.getAuthenticated({}));
    res.redirect(info.external_url);
  });

  app.get('/ghaeRegister', async (req, res, next) => {
    return res.render('ghae_register.hbs');
  });

  const addSentryContext = async (err, req, res, next) => {
    Sentry.withScope(async scope => {
      const jiraHost = (req && req.session && req.session.jiraHost) || (req && req.query && req.query.xdm_e);
      if (jiraHost) {
        scope.setTag('jiraHost', jiraHost);
      }

      if (req.body) {
        Sentry.setExtra('Body', req.body);
      }

      next(err);
    });
  };

  if (process.env.EXCEPTION_DEBUG_MODE || process.env.NODE_ENV === 'development') {
    app.get('/boom', (req, res, next) => {
      'frontend boom'.nopenope();
    });
    app.post('/boom', (req, res, next) => {
      'frontend boom'.nopenope();
    });
  }

  app.use(addSentryContext);
  // The error handler must come after controllers and before other error middleware
  app.use(Sentry.Handlers.errorHandler());

  const catchErrors = async (err, req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
      return next(err);
    }

    const errorCodes = {
      Unauthorized: 401,
      Forbidden: 403,
      'Not Found': 404,
    };

    return res.status(errorCodes[err.message] || 400).render('github-error.hbs', {
      title: 'GitHub + Jira integration',
    });
  };

  oauth.addRoutes(app);
  register.addRoutes(app);
  app.use(catchErrors);

  return app;
};
