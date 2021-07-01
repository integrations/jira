const Sentry = require('@sentry/node');

const AxiosErrorEventDecorator = require('../models/axios-error-event-decorator');
const SentryScopeProxy = require('../models/sentry-scope-proxy');
const { Subscription } = require('../models');
const getJiraClient = require('../jira/client');
const getJiraUtil = require('../jira/util');
const enhanceOctokit = require('../config/enhance-octokit');
const newrelic = require('newrelic');

// Returns an async function that reports errors errors to Sentry.
// This works similar to Sentry.withScope but works in an async context.
// A new Sentry hub is assigned to context.sentry and can be used later to add context to the error message.
const withSentry = function (callback) {
  return async (context) => {
    context.sentry = new Sentry.Hub(Sentry.getCurrentHub().getClient());
    context.sentry.configureScope(scope => scope.addEventProcessor(AxiosErrorEventDecorator.decorate));
    context.sentry.configureScope(scope => scope.addEventProcessor(SentryScopeProxy.processEvent));

    try {
      await callback(context);
    } catch (err) {
      context.sentry.captureException(err);
      throw err;
    }
  };
};

const isFromIgnoredRepo = (payload) =>
  // These point back to a repository for an installation that
  // is generating an unusually high number of push events. This
  // disables it temporarily. See https://github.com/github/integrations-jira-internal/issues/24.
  //
  // GitHub Apps install: https://admin.github.com/stafftools/users/seequent/installations/491520
  // Repository: https://admin.github.com/stafftools/repositories/seequent/lf_github_testing
  payload.installation.id === 491520 && payload.repository.id === 205972230;

const isStateChangeAction = (action) => [
  'opened',
  'closed',
  'reopened',
].includes(action);

module.exports = function middleware(callback) {
  return withSentry(async (context) => {
    enhanceOctokit(context.octokit, context.log);

    let webhookEvent = context.name;
    if (context.payload.action) {
      webhookEvent = `${webhookEvent}.${context.payload.action}`;
    }
    newrelic.addCustomAttributes({
      'Webhook ID': context.id,
      'Webhook Event': webhookEvent,
      Repository: context.payload.repository,
    });

    context.sentry.setExtra('GitHub Payload', {
      event: context.name,
      action: context.payload.action,
      id: context.id,
      repo: (context.payload.repository) ? context.repo() : undefined,
      payload: context.payload,
    });

    const gitHubInstallationId = context.payload.installation.id;
    context.log = context.log.child({ gitHubInstallationId });

    // Edit actions are not allowed because they trigger this Jira integration to write data in GitHub and can trigger events, causing an infinite loop.
    // State change actions are allowed because they're one-time actions, therefore they won’t cause a loop.
    if (context.payload.sender.type === 'Bot' && !isStateChangeAction(context.payload.action)) {
      context.log.error({ noop: 'bot', botId: context.payload.sender.id, botLogin: context.payload.sender.login }, 'Halting further execution since the sender is a bot and action is not a state change');
      return;
    }

    if (isFromIgnoredRepo(context.payload)) {
      context.log.error({ noop: 'ignored_repo', installation_id: context.payload.installation.id, repository_id: context.payload.repository.id }, 'Halting further execution since the repository is explicitly ignored');
      return;
    }

    const subscriptions = await Subscription.getAllForInstallation(gitHubInstallationId);
    if (!subscriptions.length) {
      context.log.error({ noop: 'no_subscriptions' }, 'Halting futher execution since no subscriptions were found');
      return;
    }

    context.sentry.setTag('transaction', `webhook:${context.name}.${context.payload.action}`);
    for (const subscription of subscriptions) {
      const { jiraHost } = subscription;
      context.sentry.setTag('jiraHost', jiraHost);
      context.sentry.setTag('gitHubInstallationId', gitHubInstallationId);
      context.sentry.setUser({ jiraHost, gitHubInstallationId });
      context.log = context.log.child({ jiraHost });
      if (context.timedout) {
        Sentry.captureMessage('Timed out jira middleware iterating subscriptions');
        context.log.error({ timeout: true, timeoutElapsed: context.timedout }, `Timing out at after ${context.timedout}ms`);
        return;
      }

      const jiraClient = await getJiraClient(jiraHost, gitHubInstallationId, context.log);
      if (jiraClient == null) {
        // Don't call callback if we have no jiraClient
        context.log.error({ noop: 'no_jira_client' }, `No enabled installation found for ${jiraHost}.`);
        return;
      }
      const util = getJiraUtil(jiraClient);

      try {
        await newrelic.startSegment('Middleware: webhook handler', true, async () => callback(context, jiraClient, util));
      } catch (err) {
        context.sentry.captureException(err);
      }
    }
  });
};
