const testTracking = require('../../setup/tracking');

let installation;
let install;
let body;

describe('Webhook: /events/installed', () => {
  beforeEach(() => {
    td.reset();

    body = {
      baseUrl: 'https://test-host.jira.com',
      clientKey: 'abc123',
      sharedSecret: 'ghi345',
    };

    installation = {
      id: 19,
      jiraHost: body.baseUrl,
      clientKey: body.clientKey,
      enabled: true,
      secrets: 'def234',
      sharedSecret: body.sharedSecret,
      subscriptions: jest.fn().mockResolvedValue([]),
    };

    const models = td.replace('../../../lib/models');
    td.when(models.Installation.install(td.matchers.anything()))
      // Allows us to modify installation before it's finally called
      .thenDo(async () => installation);

    install = require('../../../lib/jira/install');
  });

  afterEach(() => {
    td.reset();
  });

  test('Install', async () => {
    testTracking();
    const req = { log: { info: jest.fn() }, body };
    const res = { sendStatus: jest.fn(), on: jest.fn() };
    await install(req, res);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });
});
