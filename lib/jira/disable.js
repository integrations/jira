const {
  ActionType,
  ActionSource,
  ActionFromInstallation,
} = require('../proto/v0/action');
const { submitProto } = require('../tracking');

/**
 * Handle the disable webhook from Jira
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports = async (req, res) => {
  /** @type {{installation: import('../models/installation')}} */
  const { installation } = res.locals;
  const action = await ActionFromInstallation(installation);
  action.type = ActionType.DISABLED;
  action.actionSource = ActionSource.WEBHOOK;

  await installation.disable();

  await submitProto(action);

  req.log.info(`Installation id=${installation.id} disabled on Jira`);

  res.sendStatus(204);
};
