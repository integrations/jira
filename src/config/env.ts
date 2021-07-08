import dotenv from 'dotenv';
import path from 'path';
import envVars from './env';
import bunyan from 'bunyan';

const logger = bunyan.createLogger({ name: 'github-api' });

const filename = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
const env = dotenv.config({
  path: path.resolve(process.cwd(), filename),
});

function getProxyFromEnvironment(): string{
  let proxyHost: string = process.env.EXTERNAL_ONLY_PROXY_HOST;
  let proxyPort: string = process.env.EXTERNAL_ONLY_PROXY_PORT;

  if(!proxyHost || !proxyPort){
    return '';
  }
  const proxyAddress = `http://${proxyHost}:${proxyPort}`;

  return proxyAddress;
}

const environmentVariables = {
  MICROS_ENV: process.env.MICROS_ENV || 'development',
  MICROS_SERVICE_VERSION: process.env.MICROS_SERVICE_VERSION,
  NODE_ENV: process.env.NODE_ENV,
  SENTRY_DSN: process.env.SENTRY_DSN,
  // The proxy to use for outbound calls to GitHub. Leave empty to not use a proxy.
  GITHUB_API_PROXY: getProxyFromEnvironment(),
  ...env.parsed,
};

logger.info(`Initializing GITHUB_API_PROXY to '${environmentVariables.GITHUB_API_PROXY}'`);

export default environmentVariables;

// TODO: add checks for environment variables here and error out if missing any
if (env.error && envVars.NODE_ENV !== 'production') {
  throw env.error;
}


