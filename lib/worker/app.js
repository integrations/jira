// FIXME: This is all a bit of a hack to get access to a Probot Application
//        instance, mainly to use the `auth()` method. Probot needs refactored
//        so that method is more easily accessible.

const { Probot } = require('probot');
const { getPrivateKey } = require('@probot/get-private-key');

module.exports = new Probot({
  appId: process.env.APP_ID,
  privateKey: getPrivateKey(),
  logLevel: process.env.LOG_LEVEL,
});
