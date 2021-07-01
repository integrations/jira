const {
  ActionType,
  ActionSource,
  ActionFromInstallation,
} = require('../proto/v0/action');
const { submitProto } = require('../tracking');
/** @type {{Installation: import('../models/installation')}} */
const { Installation } = require('../models');

/**
 * Handle the install webhook from Jira
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports = async (req, res) => {
  req.log.info('Received installation payload');
  const { baseUrl: host, clientKey, sharedSecret } = req.body;
  const installation = await Installation.install({ host, clientKey, sharedSecret });
  const action = await ActionFromInstallation(installation);
  action.type = ActionType.CREATED;
  action.actionSource = ActionSource.WEBHOOK;
  res.sendStatus(204);
  await submitProto(action);
};
