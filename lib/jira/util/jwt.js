// Original source code:
// https://bitbucket.org/atlassian/atlassian-connect-express/src/f434e5a9379a41213acf53b9c2689ce5eec55e21/lib/middleware/authentication.js?at=master&fileviewer=file-view-default#authentication.js-227
const jwt = require('atlassian-jwt');

const TOKEN_KEY_PARAM = 'acpt';
const TOKEN_KEY_HEADER = `X-${TOKEN_KEY_PARAM}`;

const JWT_PARAM = 'jwt';
const AUTH_HEADER = 'authorization'; // the header name appears as lower-case

function extractJwtFromRequest(req) {
  const tokenInQuery = req.query[JWT_PARAM];

  // JWT is missing in query and we don't have a valid body.
  if (!tokenInQuery && !req.body) {
    req.log.error(
      `${'Cannot find JWT token in query parameters. ' +
        'Please include body-parser middleware and parse the urlencoded body ' +
        '(See https://github.com/expressjs/body-parser) if the add-on is rendering in POST mode. ' +
        'Otherwise please ensure the '}${JWT_PARAM} parameter is presented in query.`,
    );
    return;
  }

  // JWT appears in both parameter and body will result query hash being invalid.
  const tokenInBody = req.body[JWT_PARAM];
  if (tokenInQuery && tokenInBody) {
    req.log.error('JWT token can only appear in either query parameter or request body.');
    return;
  }
  let token = tokenInQuery || tokenInBody;

  // if there was no token in the query-string then fall back to checking the Authorization header
  const authHeader = req.headers[AUTH_HEADER];
  if (authHeader && authHeader.startsWith('JWT ')) {
    if (token) {
      const foundIn = tokenInQuery ? 'query' : 'request body';
      req.log.info(`JWT token found in ${foundIn} and in header: using ${foundIn} value.`);
    } else {
      token = authHeader.substring(4);
    }
  }

  // TODO: Remove when we discontinue the old token middleware
  if (!token) {
    token = req.query[TOKEN_KEY_PARAM] || req.header(TOKEN_KEY_HEADER);
  }

  return token;
}

function sendError(res, code, msg) {
  res.status(code).json({
    message: msg,
  });
}

const hasValidJwt = (secret, baseUrl, req, res) => {
  const token = extractJwtFromRequest(req);
  if (!token) {
    sendError(res, 401, 'Could not find authentication data on request');
    return false;
  }

  try {
    var unverifiedClaims = jwt.decode(token, '', true); // decode without verification;
  } catch (e) {
    sendError(res, 401, `Invalid JWT: ${e.message}`);
    return false;
  }

  const issuer = unverifiedClaims.iss;
  if (!issuer) {
    sendError(res, 401, 'JWT claim did not contain the issuer (iss) claim');
    return false;
  }

  let verifiedClaims;
  try {
    verifiedClaims = jwt.decode(token, secret, false);
  } catch (error) {
    sendError(res, 400, `Unable to decode JWT token: ${error}`);
    return false;
  }

  const expiry = verifiedClaims.exp;

  // todo build in leeway?
  if (expiry && Date.now() / 1000 >= expiry) {
    sendError(res, 401, 'Authentication request has expired. Try reloading the page.');
    return false;
  }

  // First check query string params
  if (verifiedClaims.qsh) {
    let expectedHash = jwt.createQueryStringHash(req, false, baseUrl);
    let signatureHashVerified = verifiedClaims.qsh === expectedHash;
    if (!signatureHashVerified) {
      var canonicalRequest = jwt.createCanonicalRequest(req, false, baseUrl) // eslint-disable-line

      // If that didn't verify, it might be a post/put - check the request body too
      expectedHash = jwt.createQueryStringHash(req, true, baseUrl);
      signatureHashVerified = verifiedClaims.qsh === expectedHash;
      if (!signatureHashVerified) {
        canonicalRequest = jwt.createCanonicalRequest(req, true, baseUrl) // eslint-disable-line

        // Send the error message for the first verification - it's 90% more likely to be the one we want.
        sendError(res, 401, 'Authentication failed: query hash does not match.');
        return false;
      }
    }
  }

  return true;
};

module.exports = {
  hasValidJwt,
};
