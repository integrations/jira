const {
  Action,
  ActionType,
  ActionSource,
  ActionFromInstallation,
  ActionFromSubscription,
} = require('../proto/v0/action');
const { submitProto } = require('../tracking');
const { Subscription } = require('../models');

/**
 * Handle the uninstall webhook from Jira
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports = async (req, res) => {
  /** @type {{installation: import('../models/installation')}} */
  const { installation } = res.locals;
  const subscriptions = await Subscription.getAllForHost(installation.jiraHost);

  /** @type {Action[]} */
  const actions = [];
  const action = await ActionFromInstallation(installation);
  action.type = ActionType.DESTROYED;
  action.actionSource = ActionSource.WEBHOOK;
  actions.push(action);

  if (subscriptions) {
    await Promise.all(subscriptions.map(async (subscription) => {
      const subAction = ActionFromSubscription(subscription, installation);
      subAction.type = ActionType.DESTROYED;
      subAction.actionSource = ActionSource.WEBHOOK;
      await subscription.uninstall();
      actions.push(subAction);
    }));
  }

  await installation.uninstall();
  await submitProto(actions);

  req.log.info(`App uninstalled on Jira. Uninstalling id=${installation.id}.`);

  res.sendStatus(204);
};
