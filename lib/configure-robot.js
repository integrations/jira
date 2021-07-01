const Redis = require('ioredis');
const RateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

const { ProbotOctokit } = require('probot');
const { createAppAuth } = require('@octokit/auth-app');

const { getPrivateKey } = require('@probot/get-private-key');

const getRedisInfo = require('./config/redis-info');
const setupFrontend = require('./frontend');
const setupGitHub = require('./github');
const setupJira = require('./jira');
const setupPing = require('./ping');
const statsd = require('./config/statsd');
const { isIp4InCidrs } = require('./config/cidr-validator');

/**
 * Get the list of GitHub CIDRs from the /meta endpoint
 *
 * This is a weird one, the /meta endpoint has a very small rate limit
 * for non-authed users, but also doesn't allow queries from authenticated
 * apps, it must be from an installation of an application. So we fetch
 * the first installation and query as it. It only happens on boot, and
 * shouldn't affect anything else, it's theoretically safe.
 *
 * @param {import('probot').Logger} logger - The Application's logger
 * @returns {string[]} A list of CIDRs for GitHub webhooks
 */
async function getGitHubCIDRs(logger) {
  let api = new ProbotOctokit({
    authStrategy: createAppAuth,
    auth: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      id: process.env.APP_ID,
      privateKey: getPrivateKey(),
    },
    logger,
  });
  const inst = await api.apps.listInstallations({
    per_page: 1,
  });
  const { token } = await api.auth({
    type: 'installation',
    installationId: inst.data[0].id,
  });
  api = new ProbotOctokit({
    auth: token,
    logger,
  });
  const metaResp = await api.meta.get();
  const GitHubCIDRs = metaResp.data.hooks;
  logger.info({ GitHubCIDRs }, 'CIDRs that can skip rate limiting');
  return GitHubCIDRs;
}

/**
 *
 * @param {import('probot').Application} app - The probot application
 */
module.exports = async (app, { getRouter }) => {
  const router = getRouter();
  if (process.env.USE_RATE_LIMITING === 'true') {
    const GitHubCIDRs = await getGitHubCIDRs(app.log);
    const client = new Redis(getRedisInfo('rate-limiter').redisOptions);
    const limiter = new RateLimit({
      store: new RedisStore({
        client,
      }),
      /**
       * Check if we should skip rate limiting
       *
       * NOTE: This is only expected to be done for IP CIDRs we trust (github)
       *
       * @param {import('express').Request} req
       * @returns {boolean} if the IP is within our non-rate-limited cidrs
       */
      skip(req) {
        return isIp4InCidrs(req.ip, GitHubCIDRs);
      },
      /**
       * Handle when a users hits the rate limit
       *
       * @param {import('express').Request} req
       * @param {import('express').Response} res
       */
      handler(req, res) {
        // We don't include path in this metric as the bots scanning us generate many of them
        statsd.increment('express.rate_limited');
        res.status(429).send('Too many requests, please try again later.');
      },
      max: 100, // limit each IP to a number of requests per windowMs
      delayMs: 0, // disable delaying - full speed until the max limit is reached
    });

    router.use(limiter);
  }

  // These incoming webhooks should skip rate limiting
  setupGitHub(app);
  // According to NewRelic, we receive < 1 request per minute from Jira
  setupJira(app, { getRouter });
  // Our FrontEnd Assets are between 1 and 4 RPM
  setupFrontend(app, { getRouter });
  // Opaque is expected to query us twice per minute
  setupPing(app, { getRouter });

  return app;
};
