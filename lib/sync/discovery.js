const { Subscription } = require('../models');
const { getRepositorySummary } = require('./jobs');
const enhanceOctokit = require('../config/enhance-octokit');

const jobOpts = {
  removeOnComplete: true,
  removeOnFail: true,
  attempts: 3,
};

module.exports.discovery = (app, queues) => async function discoverContent(job) {
  const startTime = new Date();
  const { jiraHost, installationId } = job.data;
  const github = await app.auth(installationId);
  enhanceOctokit(github, app.log);

  const repositories = await github.paginate(github.apps.listReposAccessibleToInstallation.endpoint.merge(({ per_page: 100 }), res => res.data.repositories));
  app.log(`${repositories.length} Repositories found for installationId=${installationId}`);

  const subscription = await Subscription.getSingleInstallation(jiraHost, installationId);
  if (repositories.length === 0) {
    subscription.syncStatus = 'COMPLETE';
    await subscription.save();
    return;
  }

  // Store the repository object to prevent doing an additional query in each job
  // Also, with an object per repository we can calculate which repos are synched or not
  const repos = repositories.reduce((obj, repo) => {
    obj[repo.id] = { repository: getRepositorySummary(repo) };
    return obj;
  }, {});
  subscription.set('repoSyncState.repos', repos);
  subscription.set('repoSyncState.numberOfSyncedRepos', 0);
  await subscription.save();

  // Create job
  queues.installation.add({ installationId, jiraHost, startTime }, jobOpts);
};
