const crypto = require('crypto');
const url = require('url');
const fetch = require('node-fetch');
const { AppSecrets, Registration } = require('../models');
const parseHost = require('../util/parse-host-from-url');

module.exports = function (opts) {
  if (!opts.callbackURI) opts.callbackURI = '/ghaeRegisterComplete';
  if (!opts.registerURI) opts.registerURI = '/register';
  app_url = process.env.APP_URL;

  // TODO: correct url, how to get app name
  registration_data = JSON.stringify({
    name: 'Jira-App',
    url: 'https://github.com/apps/Jira-App',
    hook_attributes: {
        url: `${app_url}/github/events`,
    },
    redirect_url: `${app_url}/ghaeRegisterComplete/`,
    callback_urls: [
        `${app_url}/github/callback`
    ],
    setup_url: `${app_url}/github/setup`,
    default_permissions: {
        issues: 'write',
        contents: 'read',
        metadata: 'read',
        pull_requests: 'write'
      },
      default_events: [
        'create',
        'commit_comment',
        'delete',
        'issue_comment',
        'issues',
        'pull_request',
        'pull_request_review',
        'pull_request_review_comment',
        'push'
      ],
    public: false})

  function addRoutes(router, loginCallback) {
    // compatible with flatiron/director
    router.post(opts.registerURI, (res, req) => register(res, req));
    router.get(opts.callbackURI, callback);
  }

  async function register(req, res, redirectUrl) {
    const { query } = url.parse(req.url, true);
    const { ghaeHost } = query;
    // TODO: validate ghae url
    const state = crypto.randomBytes(16).toString('hex');

    //save state and host for request validation
    const registration = await Registration.insert({githubHost: ghaeHost, state: state});
    return res.json({
        manifest: registration_data,
        state
    });
  }

  async function callback(req, res, next) {
    const { query } = url.parse(req.url, true);
    const { code, state } = query;

    //check valid referer, needed to validate ghaehost
    if(!req.get('referer')){
        res.status(400);
        res.json({
          err: 'Request not coming from valid referer',
        });
        return;
    }
    let ghaeHost = parseHost(req.get('referer'));
    // Check state & code present in params
    if(!state){
        res.status(400);
        res.json({
          err: 'Missing matching Auth state parameter',
        });
        return;
    }

    if (!code){
        res.status(400);
        res.json({
          err: 'Missing OAuth Code',
        });
        return;
    }

    //retrive ghaeHost from state
    let registration = await Registration.getRegistration(state);
    
    //check valid state or not
    if(!registration){
        res.status(401);
        res.json({
          err: 'Invalid Auth state parameter',
        });
        return;
    }
    let githubHost = registration.githubHost;

    //check valid ghaehost
    if(githubHost != ghaeHost){
        res.status(401);
        res.json({
          err: 'Request coming from invalid host',
        });
        return;
    }

    url_fetch = `https://${githubHost}/api/v3/app-manifests/${code}/conversions`
    let result = await fetch(url_fetch,{
            method: 'POST',
            headers:{
              'accept': 'application/vnd.github.v3+json'
          }
          }).then(response => response.json()).then(data => {return data}).catch((error) => {
            console.error('Error:', error);
          });
    
    // remove registration as we have successfully validate state param
    await registration.remove();
    
    // TODO: handle single app for single host
    if (result.id) {
        await AppSecrets.insert({
            clientId: result.client_id,
            clientSecret: result.client_secret,
            privateKey: result.pem,
            appId: result.id,
            githubHost: new URL(result.html_url).hostname,
            webhookSecret: result.webhook_secret
        });
    } else {
        res.status(400);
        res.json({
          err: 'Github Auth code invalidated',
        });
        return;
    }
    
    return res.render('ghae_register_complete.hbs', {
      app: JSON.stringify(result)
    });
  }

  return {
    addRoutes
  };
};