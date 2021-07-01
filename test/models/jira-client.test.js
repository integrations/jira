const nock = require('nock');
const { getLog } = require('../../lib/config/logger');

const JiraClient = require('../../lib/models/jira-client');

describe(JiraClient, () => {
  describe('isAuthorized()', () => {
    const buildClient = ({ status }) => {
      let logger = getLog();
      const installation = { jiraHost: 'https://example.atlassian.net', sharedSecret: 'secret' };
      const jiraClient = new JiraClient(installation, logger);

      nock('https://example.atlassian.net')
        .get('/rest/devinfo/0.10/existsByProperties?fakeProperty=1')
        .reply(status);

      return jiraClient;
    };

    it('is true when response is 200', async () => {
      const jiraClient = buildClient({ status: 200 });

      const isAuthorized = await jiraClient.isAuthorized();
      expect(isAuthorized).toBe(true);
    });

    it('is false when response is 302', async () => {
      const jiraClient = buildClient({ status: 302 });

      const isAuthorized = await jiraClient.isAuthorized();
      expect(isAuthorized).toBe(false);
    });

    it('is false when response is 403', async () => {
      const jiraClient = buildClient({ status: 403 });

      const isAuthorized = await jiraClient.isAuthorized();
      expect(isAuthorized).toBe(false);
    });

    it('rethrows non-response errors', async () => {
      const jiraClient = buildClient({ status: 200 });

      jest.spyOn(jiraClient.axios, 'get').mockImplementation(() => { throw new Error('boom'); });

      await expect(jiraClient.isAuthorized()).rejects.toThrow('boom');
    });
  });
});
