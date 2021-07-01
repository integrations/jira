const pino = require('pino');
const { getTransformStream } = require('@probot/pino');

function getLog(options = {}) {
  const { level, logMessageKey, ...getTransformStreamOptions } = options;
  const pinoOptions = {
    level: level || 'info',
    name: 'probot',
    messageKey: logMessageKey || 'msg',
  };
  const transform = getTransformStream(getTransformStreamOptions);

  transform.pipe(pino.destination(1));
  const log = pino(pinoOptions, transform);
  return log;
}
exports.getLog = getLog;
