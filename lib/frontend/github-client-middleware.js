const { GitHubAPI } = require('../config/github-api');
const { sign } = require('jsonwebtoken');

module.exports = (getAppToken) => (req, res, next) => {
  if (req.session.githubToken) {
    res.locals.github = GitHubAPI({
      auth: { token: req.session.githubToken },
    });
  } else {
    res.locals.github = GitHubAPI();
  }

  const isAdminFunction = isAdmin(res.locals.github);

  const appClient = GitHubAPI({
    auth: { token: getSignedJsonWebToken(getAppToken.state) },
  });

  res.locals.client = appClient;
  res.locals.isAdmin = isAdminFunction;

  next();
};

/**
 * @returns true if the user is an admin of the Org or if the repo belongs to that user
 */
function isAdmin(githubClient) {
  return async function ({ org, username, type }) {
    // If this is a user installation, the "admin" is the user that owns the repo
    if (type === 'User') {
      return org === username;
    }

    // Otherwise this is an Organization installation and we need to ask GitHub for role of the logged in user
    try {
      const {
        data: { role },
      } = await githubClient.orgs.getMembershipForUser({ org, username });
      return role === 'admin';
    } catch (err) {
      console.log(err);
      console.log(`${org} has not accepted new permission for getOrgMembership`);
      console.log(`error=${err} org=${org}`);
      return false;
    }
  };
}

function getSignedJsonWebToken({ appId, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + 60 * 10 - 30,
    iss: appId,
  };
  const token = sign(payload, privateKey, { algorithm: 'RS256' });
  return token;
}

module.exports.isAdminFunction = isAdmin;
