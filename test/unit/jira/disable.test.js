const { getHashedKey } = require('../../../lib/models/installation');
const disable = require('../../../lib/jira/disable');
const testTracking = require('../../setup/tracking');

let installation;

describe('Webhook: /events/disabled', () => {
  test('Existing Installation', async () => {
    testTracking();
    installation = {
      id: 19,
      jiraHost: 'https://test-host.jira.com',
      clientKey: getHashedKey('abc123'),
      enabled: true,
      secrets: 'def234',
      sharedSecret: 'ghi345',
      disable: jest.fn().mockResolvedValue(installation),
      subscriptions: jest.fn().mockResolvedValue([{ gitHubInstallationId: 10 }]),
    };
    const req = { log: { info: jest.fn() } };
    const res = { locals: { installation }, sendStatus: jest.fn() };
    await disable(req, res);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
    expect(installation.disable).toHaveBeenCalled();
  });
});
