const testTracking = require('../../setup/tracking');

let installation;
let enable;

describe('Webhook: /events/enabled', () => {
  beforeEach(() => {
    td.reset();

    installation = {
      id: 19,
      jiraHost: 'https://test-host.jira.com',
      clientKey: 'abc123',
      enabled: true,
      secrets: 'def234',
      sharedSecret: 'ghi345',
      subscriptions: jest.fn().mockResolvedValue([]),
    };

    const models = td.replace('../../../lib/models');
    td.when(models.Installation.getPendingHost(installation.jiraHost))
      // Allows us to modify installation before it's finally called
      .thenDo(async () => installation);

    enable = require('../../../lib/jira/enable');
  });

  afterEach(() => {
    td.reset();
  });

  test('Pending Installation', async () => {
    testTracking();
    const req = { log: { info: jest.fn() }, body: { baseUrl: installation.jiraHost } };
    const res = { sendStatus: jest.fn(), on: jest.fn() };
    await enable(req, res);
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });

  test('No Pending Installation', async () => {
    installation = null;
    const req = { log: { info: jest.fn() }, body: { baseUrl: 'https://no-exist.jira.com' } };
    const res = { sendStatus: jest.fn(), on: jest.fn() };
    await enable(req, res);
    expect(res.sendStatus).toHaveBeenCalledWith(422);
  });
});
