const Redis = require('ioredis');

const getRedisInfo = require('./config/redis-info');
const { sequelize } = require('./models');

/**
 * Create a /_ping endpoint
 *
 * @param {import('probot').Application} robot - The probot app
 */
module.exports = (robot, { getRouter }) => {
  const app = getRouter('/');
  const cache = new Redis(getRedisInfo('ping').redisOptions);

  /**
   * /_ping endpoint to checks to see that all our connections are OK
   *
   * It's a race between the setTimeout and our ping + authenticate.
   */
  app.get('/_ping', async (req, res) => {
    let connectionsOk = true;
    try {
      await Promise.race([
        Promise.all([
          cache.ping().catch((_, reject) => {
            req.log.error('Error issuing PING to redis');
            reject(new Error('connection'));
          }),
          sequelize.authenticate().catch((_, reject) => {
            req.log.error('Error issuing authenticate to Sequelize');
            reject(new Error('connection'));
          }),
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
      ]);
    } catch (err) {
      connectionsOk = false;
    }

    if (connectionsOk) {
      return res.status(200).send('OK');
    }
    req.log.error('Error attempting to ping Redis and Database');
    return res.status(500).send('NOT OK');
  });
};
