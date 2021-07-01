const { getHashedKey } = require('../../../lib/models/installation');
const testTracking = require('../../setup/tracking');

let installation;
let subscriptions;
let uninstall;

describe('Webhook: /events/uninstalled', () => {
  beforeEach(() => {
    td.reset();

    subscriptions = [{
      gitHubInstallationId: 10,
      jiraHost: 'https://test-host.jira.com',
      uninstall: jest.fn().mockName('uninstall').mockResolvedValue(1),
    }];
    installation = {
      id: 19,
      jiraHost: 'https://test-host.jira.com',
      clientKey: getHashedKey('abc123'),
      enabled: true,
      secrets: 'def234',
      sharedSecret: 'ghi345',
      uninstall: jest.fn().mockName('uninstall').mockResolvedValue(installation),
      subscriptions: jest.fn().mockName('subscriptions').mockResolvedValue(subscriptions),
    };

    const models = td.replace('../../../lib/models');
    td.when(models.Subscription.getAllForHost(installation.jiraHost))
      // Allows us to modify subscriptions before it's finally called
      .thenDo(async () => subscriptions);

    uninstall = require('../../../lib/jira/uninstall');
  });

  afterEach(() => {
    td.reset();
  });

  test('Existing Installation', async () => {
    testTracking();
    const req = { log: { info: jest.fn() } };
    const res = { locals: { installation }, sendStatus: jest.fn() };
    await uninstall(req, res);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
    expect(installation.uninstall).toHaveBeenCalled();
    expect(subscriptions[0].uninstall).toHaveBeenCalled();
  });

  test('Existing Installation, no Subscriptions', async () => {
    testTracking();
    const req = { log: { info: jest.fn() } };
    const res = { locals: { installation }, sendStatus: jest.fn() };
    subscriptions = [];
    await uninstall(req, res);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
    expect(installation.uninstall).toHaveBeenCalled();
  });
});
