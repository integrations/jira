import {GitHubAPI} from 'probot';
import bunyan from 'bunyan';
import Redis from 'ioredis';
import Bottleneck from 'bottleneck';
import getRedisInfo from './redis-info';
import {Options} from 'probot/lib/github';
import {HttpsProxyAgent} from 'https-proxy-agent';
import envVars from './env';

const { GITHUB_API_PROXY } = envVars;

const logger = bunyan.createLogger({ name: 'github-api' });

// Just create one connection and share it
const {redisOptions} = getRedisInfo('octokit');
const client = new Redis(redisOptions);
const connection = new Bottleneck.IORedisConnection({client});

export default (options: Partial<GithubAPIOptions> = {}): GitHubAPI => {
  options.logger = options.logger || logger;
  if (process.env.NODE_ENV === 'test') {
    // Don't throttle at all
    options.throttle = {
      enabled: false,
    };
  }

  // Configure the Bottleneck Redis Client
  options.bottleneck = options.bottleneck || Bottleneck;
  options.connection = options.connection || connection;

  if(GITHUB_API_PROXY) {
    options.agent = new HttpsProxyAgent(GITHUB_API_PROXY)
  }

  return GitHubAPI(options as Options);
}

interface GithubAPIOptions extends Options {
  connection?: Bottleneck.IORedisConnection;
  bottleneck?: typeof Bottleneck;
}
