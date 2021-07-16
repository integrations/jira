const { Project } = require('../models');
const transformPullRequest = require('../transforms/pull-request');
const reduceProjectKeys = require('../jira/util/reduce-project-keys');
const parseSmartCommit = require('../transforms/smart-commit');

module.exports = async (context, jiraClient, util) => {
  const author = await context.github.users.getByUsername({ username: context.payload.pull_request.user.login });
  let reviews = {};
  try {
    reviews = await context.github.pulls.listReviews({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      pull_number: context.payload.pull_request.number,
    });
  } catch (e) {
    context.log.warn({
      error: e,
      payload: context.payload,
    }, "Can't retrieve reviewers.");
  }
  let commits = [];
  try {
    commits = await context.github.pulls.listCommits({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      pull_number: context.payload.pull_request.number,
    });
  } catch (e) {
    context.log.warn({
      error: e,
      payload: context.payload,
    }, "Can't retrieve PR commits.");
  }
  const { data: jiraPayload } = transformPullRequest(context.payload, author.data, reviews.data, commits);
  const { pull_request: pullRequest } = context.payload;

  if (!jiraPayload && (context.payload.changes && context.payload.changes.title)) {
    const hasIssueKeys = !!parseSmartCommit(context.payload.changes.title.from);
    if (hasIssueKeys) {
      return jiraClient.devinfo.pullRequest.delete(context.payload.repository.id, pullRequest.number);
    }
  }

  const linkifiedBody = await util.unfurl(pullRequest.body);
  if (linkifiedBody) {
    const editedPullRequest = context.issue({
      body: linkifiedBody,
      id: pullRequest.id,
    });
    await context.github.issues.update(editedPullRequest);
  }

  if (!jiraPayload) {
    context.log({ noop: 'no_jira_payload_pull_request' }, 'Halting futher execution for pull request since jiraPayload is empty');
    return;
  }

  await jiraClient.devinfo.repository.update(jiraPayload);

  const projects = [];
  jiraPayload.pullRequests.map(pull => reduceProjectKeys(pull, projects));
  jiraPayload.branches.map(branch => reduceProjectKeys(branch, projects));

  for (const projectKey of projects) {
    await Project.upsert(projectKey, jiraClient.baseURL);
  }
};
