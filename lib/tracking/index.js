const process = require('process');
const https = require('https');
const { default: axios } = require('axios');
const crypto = require('crypto');

const { getLog } = require('../config/logger');
const statsd = require('../config/statsd');
const { asyncDistTimer } = require('../config/statsd');

const BaseURL = process.env.HYDRO_BASE_URL;

const axiosInstance = axios.create({
  // Set a short timeout, this are disposable
  timeout: 500,
  httpsAgent: new https.Agent({
    keepAlive: true,
  }),
});
axiosInstance.defaults.headers.common['X-Hydro-App'] = 'jira-integration';

const submissionMetricName = 'hydro.submission';
const postMetricName = 'hydro.dist.post';
const logErrStatuses = {
  400: 'Hydro Missing clientID Header',
  404: 'Hydro Unknown Schema',
  422: 'Hydro Invalid Payload',
  failure: 'Unable to connect to hydro to submit',
};
let disabled = ['true', '1'].includes(process.env.TRACKING_DISABLED);
let logger = getLog();
if (BaseURL == null) {
  disabled = true;
  logger.warn('No Hydro Base URL set, disabling tracking');
}

/**
 * Ability to turn tracking on/off.
 *
 * @param {boolean} state - If the tracking should be disabled or not
 * @returns {void}
 */
function setIsDisabled(state) {
  disabled = state;
}

/**
 * Return if tracking is disabled or not.
 *
 * @returns {boolean} If tracking is disabled
 */
function isDisabled() {
  return disabled;
}

/**
 * Submit Events to the HTTP Gateway
 *
 * @param {import('../proto/v0/action').BaseProtobuf | import('../proto/v0/action').BaseProtobuf[]} protos - The protobuf we want to submit
 * @returns {Promise<boolean>} A promise that when resolved indicates if the submission was received successfully
 *
 * @example
 * ```
 * const data = new Action();
 * action.type = ActionType.CREATED;
 * action.association = Association.SUBSCRIPTION;
 * action.actionSource = ActionSource.WEBHOOK;
 * await submitProto(data);
 * ```
 */
async function submitProto(protos) {
  if (disabled) {
    return true;
  }
  if (!(protos instanceof Array)) {
    protos = [protos];
  }
  const data = {
    events: protos.map((proto) => ({
      schema: proto.schema,
      value: JSON.stringify(proto),
      cluster: 'potomac',
    })),
  };

  const dataStr = JSON.stringify(data);
  const hmac = crypto.createHmac('sha256', process.env.HYDRO_APP_SECRET || '');
  hmac.update(dataStr);

  /** @type {import('axios').AxiosResponse} */
  let resp;
  /** @type {number|string} */
  let status;
  try {
    const axiosPost = async () =>
      axiosInstance.post(
        BaseURL,
        dataStr,
        {
          headers: {
            Authorization: `Hydro ${hmac.digest('hex')}`,
            'Content-Type': 'application/json',
          },
        },
      );
    resp = await asyncDistTimer(axiosPost, postMetricName)();
    status = resp.status;
    logger.debug('Hydro Protobuf Accepted', data);
  } catch (err) {
    if (err.response == null) {
      // This is not an AxiosError
      logger.error(err);
      status = 'exception';
    } else {
      /** @type {import('axios').AxiosError} */
      const axError = err;
      /** @type {any} - The response data */
      let respData;

      resp = axError.response;
      if (resp == null || resp.status == null) {
        status = 'conn_failure';
      } else {
        status = resp.status;
        respData = resp.data;
      }

      if (status in logErrStatuses) {
        logger.error(logErrStatuses[status], { status, resp: respData, data });
      } else {
        logger.error('Hydro Submission Issue', { status, resp: respData, data });
      }
    }
  }

  // Report counts of each schema type (in case we have a heterogeneous list)
  const protoStats = protos.reduce((accumulator, current) => {
    if (accumulator[current.schema] == null) {
      accumulator[current.schema] = 0;
    }
    accumulator[current.schema] += 1;
    return accumulator;
  }, {});
  Object.entries(protoStats).forEach((stats) => {
    const [name, count] = stats;
    statsd.increment(
      submissionMetricName,
      count,
      [`schema:${name}`, `status:${status}`],
    );
  });

  return status === 200;
}

module.exports = {
  submitProto,
  setIsDisabled,
  isDisabled,
  BaseURL,
};
