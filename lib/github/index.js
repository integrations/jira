const newrelic = require('newrelic');
const issueComment = require('./issue-comment');
const issue = require('./issue');
const middleware = require('./middleware');
const pullRequest = require('./pull-request');
const push = require('./push');
const { createBranch, deleteBranch } = require('./branch');
const webhookTimeout = require('../middleware/webhook-timeout');

/**
 * @param {import('probot').Application} robot - The probot instance
 */
module.exports = (robot) => {
  /**
   * @param {import('probot').Context} context - The incoming request context.
   */
  robot.onAny((context) => {
    newrelic.setControllerName(`github/events.${context.name}`);
    context.log({ event: context.name, action: context.payload.action }, 'Event received');
  });

  robot.on(['issue_comment.created', 'issue_comment.edited'], webhookTimeout(middleware(issueComment)));

  robot.on(['issues.opened', 'issues.edited'], middleware(issue));

  robot.on('push', middleware(push));

  robot.on([
    'pull_request.opened',
    'pull_request.closed',
    'pull_request.reopened',
    'pull_request.edited',
    'pull_request_review',
  ], middleware(pullRequest));

  robot.on('create', middleware(createBranch));
  robot.on('delete', middleware(deleteBranch));
};
