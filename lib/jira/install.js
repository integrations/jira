const { Installation } = require('../models')
const getAxiosInstance = require('../jira/client/axios')
const jwt = require('./util/jwt')

module.exports = async (req, res) => {
  req.log('Received installation payload.')
  const { baseUrl: host, clientKey, sharedSecret } = req.body
  let requiresInstallationUpdate = false

  try {
    const hostData = await Installation.getForClientKey(clientKey)
    if (jwt.hasValidJwt(hostData.sharedSecret, host, req, res)) {
      res.sendStatus(204)
      requiresInstallationUpdate = true
    }
  } catch (err) {
    // Client key has not been seen before. Safe to install.
    res.sendStatus(204)
    requiresInstallationUpdate = true
  }
  res.on('finish', async () => {
    if (!requiresInstallationUpdate) {
      return
    }
    const instance = getAxiosInstance(null, {}, host, sharedSecret)
    try {
      // Validate the clientKey and the sharedSecret
      // We have to do this after responding with 204 because
      // otherwise we get an error "The add-on is not enabled"
      // no matter what we send
      const result = await instance.get(`/rest/devinfo/0.10/existsByProperties?fakeProperty=1`)
      if (result.status === 200) {
        req.log('App installed on Jira. Adding secrets.')
        await Installation.install({ host, clientKey, sharedSecret })
      } else {
        req.log('App not installed. Verification failed.')
      }
    } catch (err) {
      if (err.response.status === 401) {
        req.log('Jira does not recognize this installation. Deleting it.')
        await Installation.uninstall({ clientKey })
      }
    }
  })
}
