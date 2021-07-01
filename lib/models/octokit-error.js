const SentryScopeProxy = require('./sentry-scope-proxy');

/*
 * Wraps an Octokit HttpError and extracts metadata for Sentry.
 *
 * Intended to be used by `octokit.hook.wrap('request')`
 */
class OctokitError extends Error {
  /*
   * Takes an octokit instance and wraps request errors. Useful when the octokit is instantiated by someone else (i.e., Probot)
   */
  static wrapRequestErrors(octokit) {
    octokit.hook.wrap('request', async (request, options) => {
      try {
        const response = await request(options);
        return response;
      } catch (error) {
        throw new OctokitError(error.response, options);
      }
    });
  }

  constructor(httpError, requestOptions) {
    super(`${requestOptions.method} ${requestOptions.url} responded with ${httpError.status}`);

    this.name = this.constructor.name;
    this.httpError = httpError;
    this.requestOptions = requestOptions;

    this.sentryScope = new SentryScopeProxy();
    this.sentryScope.extra.request = this.requestMetadata();
    this.sentryScope.extra.response = this.responseMetadata();
    this.sentryScope.fingerprint = this.generateFingerprint();
  }

  get responseCode() {
    return this.httpError.status;
  }

  requestMetadata() {
    return {
      method: this.requestOptions.method,
      path: this.requestOptions.url,
      headers: this.requestOptions.headers,
    };
  }

  responseMetadata() {
    return {
      code: this.responseCode,
      body: this.deserializeMessage(this.httpError.message),
      headers: this.httpError.headers,
    };
  }

  generateFingerprint() {
    return [
      '{{ default }}',
      this.requestOptions.method,
      this.requestOptions.url,
      this.responseCode,
    ];
  }

  deserializeMessage(message) {
    try {
      return JSON.parse(message);
    } catch (error) {
      if (error.name !== 'SyntaxError') {
        throw error;
      }
    }

    return message;
  }
}

module.exports = OctokitError;
