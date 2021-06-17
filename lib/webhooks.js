const { Probot } = require('probot');
const newrelic = require('newrelic');
const { Webhooks } = require('@octokit/webhooks');
const express = require('express');

const pullRequest = require('./github/pull-request');
const issueComment = require('./github/issue-comment');
const issue = require('./github/issue');
const middleware = require('./github/middleware');
const push = require('./github/push');
const { createBranch, deleteBranch } = require('./github/branch');
const webhookTimeout = require('./middleware/webhook-timeout');
// const { extractBaseURL } = require('./common/helper');
// const { getInstanceMetadata } = require('./common/helper');
const logMiddleware = require('./middleware/log-middleware');
const { Sentry } = require('./config/sentry');

/**
 * Create a /github/events endpoint
 *
 */

module.exports = (robot, { getRouter }) => {
  const app = getRouter('/');
  /**
   * /github/events endpoint receive webhooks
   *
   */
  // The request handler must be the first middleware on the app
  app.use(Sentry.Handlers.requestHandler());
  app.use(express.json());
  app.use(logMiddleware);

  app.post('/github/events', async (req, res) => {
    const payload = req.body;
    // TODO: Uncomment this line and the corresponding 'require' statement once the extractBaseURL method has been included in the main branch
    // const githubHost = extractBaseURL(payload).split('/api')[0].split('https://')[1];
    // TODO: Uncomment this line and the corresponding 'require' statement once the getInstanceMetadata method has been included in the main branch
    // const ghaeInstanceData = await getInstanceMetadata(githubHost);

    const webhookSecret = ghaeInstanceData.webhookSecret;
    const webhooks = new Webhooks({
      secret: webhookSecret,
    });

    // Verify the webhook payload
    let signature = (githubHost === 'github.com') ? req.get('X-Hub-Signature') : req.get('X-Hub-Signature-256');
    const isValidWebhook = webhooks.verify(payload, signature);

    if (isValidWebhook) {
      const probot = new Probot({
        appId: ghaeInstanceData.appId,
        privateKey: ghaeInstanceData.privateKey,
        secret: webhookSecret,
      });

      const { action } = payload;
      const eventName = req.get('X-GitHub-Event');
      let eventNameWithAction = eventName;
      if (action) {
        eventNameWithAction = `${eventName}.${action}`;
      }

      const context = {
        id: req.headers['x-github-delivery'] || req.headers['x-request-id'],
        github: probot.auth,
        payload,
        octokit: probot.state.octokit,
        log: probot.log,
        name: eventName,
        repo(object) {
          const repo = this.payload.repository;
          if (!repo) {
            throw new Error('context.repo() is not supported for this webhook event.');
          }
          return Object.assign({
            owner: repo.owner.login || repo.owner.name,
            repo: repo.name,
          }, object);
        },
        issue(object) {
          const payload = this.payload;
          return Object.assign({
            issue_number: (payload.issue || payload.pull_request || payload).number,
          }, this.repo(object));
        },
        pullRequest(object) {
          const payload = this.payload;
          return Object.assign({
            pull_number: (payload.issue || payload.pull_request || payload).number,
          }, this.repo(object));
        },
      };

      newrelic.setControllerName(`github/events.${context.name}`, context.payload.action);
      context.log({ event: context.name, action: context.payload.action }, 'Event received');

      const processableEventActions = ['issue_comment.created', 'issue_comment.edited', 'issues.opened', 'issues.edited',
        'push', 'pull_request.opened', 'pull_request.closed', 'pull_request.reopened', 'pull_request.edited', 'create', 'delete'];
      if (!(processableEventActions.includes(eventNameWithAction))) {
        return res.send(200);
      }

      const eventActionsForWebhookTimeout = ['issue_comment.created', 'issue_comment.edited'];
      if (eventActionsForWebhookTimeout.includes(eventNameWithAction)) {
        const handler = middleware((context, jiraClient, util) => {
          issueComment(context, jiraClient, util);
        });
        await webhookTimeout(handler(context));
        return res.send(200);
      }

      const handler = middleware((context, jiraClient, util) => {
        switch (eventNameWithAction) {
          case 'pull_request.opened':
          case 'pull_request.closed':
          case 'pull_request.reopened':
          case 'pull_request.edited':
            pullRequest(context, jiraClient, util);
            break;
          case 'issues.opened':
          case 'issues.edited':
            issue(context, jiraClient, util);
            break;
          case 'push':
            push(context, jiraClient, util);
            break;
          case 'create':
            createBranch(context, jiraClient, util);
            break;
          case 'delete':
            deleteBranch(context, jiraClient, util);
            break;
          default:
            console.log('default');
        }
      });
      await handler(context);
      return res.send(200);
    } else {
      // Couldn't validate the webhook, so we send an "Unauthorized" code
      return res.send(401);
    }
  });
};
