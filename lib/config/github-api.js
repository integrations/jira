const { ProbotOctokit } = require('probot');
const Redis = require('ioredis');
const Bottleneck = require('bottleneck');
const { redisOptions } = require('./redis-info')('octokit');

// Just create one connection and share it
const client = new Redis(redisOptions);
const connection = new Bottleneck.IORedisConnection({ client });

function GitHubAPI(options = {}) {
  let finalOptions = {};
  if (process.env.NODE_ENV === 'test') {
    finalOptions = {
      // Don't throttle at all
      throttle: {
        enabled: false,
      },
      // Don't retry failures
      request: { retries: 0 },
    };
  }

  // Configure the Bottleneck Redis Client
  if (!options.connection && !options.Bottleneck) {
    Object.assign(finalOptions, { connection, Bottleneck });
  }

  Object.assign(finalOptions, options);

  return new ProbotOctokit(finalOptions);
}

module.exports = {
  GitHubAPI,
};
