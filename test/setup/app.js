const { Probot, ProbotOctokit } = require('probot');
const { getPrivateKey } = require('@probot/get-private-key');

beforeEach(async () => {
  const models = td.replace('../../lib/models', {
    Installation: td.object([
      'getForHost',
      'findByPk',
      'build',
      'getPendingHost',
      'install',
    ]),
    Subscription: td.object([
      'getAllForInstallation',
      'install',
      'getSingleInstallation',
      'findOrStartSync',
      'getAllForHost',
    ]),
    Project: td.object(['upsert']),
  });

  td.when(models.Installation.getForHost(process.env.ATLASSIAN_URL))
    .thenReturn({
      jiraHost: process.env.ATLASSIAN_URL,
      sharedSecret: process.env.ATLASSIAN_SECRET,
    });

  td.when(models.Subscription.getAllForInstallation(1234))
    .thenReturn([
      {
        jiraHost: process.env.ATLASSIAN_URL,
      },
    ]);

  td.when(models.Subscription.getSingleInstallation(process.env.ATLASSIAN_URL, 1234))
    .thenReturn({ id: 1, jiraHost: process.env.ATLASSIAN_URL });

  td.when(models.Project.upsert('PROJ-1', process.env.ATLASSIAN_URL))
    .thenReturn({
      projectKey: 'PROJ',
      upsert: () => Promise.resolve(),
    });

  nock('https://api.github.com')
    .post(/\/app\/installations\/[\d\w-]+\/access_tokens/)
    .reply(200, {
      token: 'mocked-token',
      expires_at: '9999-12-31T23:59:59Z',
    })
    .get('/repos/test-repo-owner/test-repo-name/contents/.github/jira.yml')
    .reply(200, {
      content: Buffer.from(`jira: ${process.env.ATLASSIAN_URL}`).toString('base64'),
    });

  const configureRobot = require('../../lib/configure-robot');
  const { Router } = require('express');

  global.app = await configureRobot(new Probot({
    appId: 12257,
    githubToken: 'test',
    privateKey: getPrivateKey(),
    Octokit: ProbotOctokit.defaults({
      retry: { enabled: false },
      throttle: { enabled: false },
    }),
  }), { getRouter: Router });
});

afterEach(() => {
  nock.cleanAll();
  td.reset();
});
