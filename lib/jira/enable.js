const {
  ActionType,
  ActionSource,
  ActionFromInstallation,
} = require('../proto/v0/action');
const { submitProto } = require('../tracking');
const { Installation } = require('../models');
const verifyInstallation = require('./verify-installation');

/**
 * Handle the enable webhook from Jira
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports = async (req, res) => {
  const jiraHost = req.body.baseUrl;

  const installation = await Installation.getPendingHost(jiraHost);
  if (installation) {
    const action = await ActionFromInstallation(installation);
    action.type = ActionType.ENABLED;
    action.actionSource = ActionSource.WEBHOOK;
    res.on('finish', verifyInstallation(installation, req.log));
    res.sendStatus(204);
    await submitProto(action);
  } else {
    req.log.info(`No pending installation found for jiraHost=${jiraHost}`);
    res.sendStatus(422);
  }
};
