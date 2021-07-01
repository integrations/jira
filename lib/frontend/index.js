const sslify = require('express-sslify');
const helmet = require('helmet');

const getFrontendApp = require('./app');

function secureHeaders(app, frontendApp) {
  // Content Security Policy
  app.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'none'"],
      // Allow <script> tags hosted by ourselves and from atlassian when inserted into an iframe
      scriptSrc: ["'self'", process.env.APP_URL, 'https://*.atlassian.net', 'https://*.jira.com', 'https://connect-cdn.atl-paas.net/'],
      // Allow XMLHttpRequest/fetch requests
      connectSrc: ["'self'", process.env.APP_URL],
      // Allow <style> tags hosted by ourselves as well as style="" attributes
      styleSrc: ["'self'", "'unsafe-inline'"],
      // Allow self-hosted images, data: images, organization images and the error image
      imgSrc: ["'self'", 'data:', 'https://*.githubusercontent.com', 'https://octodex.github.com'],
    },
  }));
  // Enable HSTS with the value we use for education.github.com
  app.use(helmet.hsts({
    maxAge: 15552000,
  }));
  // X-Frame / Clickjacking protection
  // Disabling this. Will probably need to dynamically
  // set this based on the referrer URL and match if it's *.atlassian.net or *.jira.com
  // app.use(helmet.frameguard({ action: 'deny' }))
  // MIME-Handling: Force Save in IE
  app.use(helmet.ieNoOpen());
  // Disable cachingç
  app.use(helmet.noCache());
  // Disable mimetype sniffing
  app.use(helmet.noSniff());
  // Basic XSS Protection
  app.use(helmet.xssFilter());

  // Remove the X-Powered-By
  // This particular combination of methods works
  frontendApp.disable('x-powered-by');
  app.use(helmet.hidePoweredBy());
}

module.exports = (robot, { getRouter }) => {
  const app = getRouter();

  if (process.env.FORCE_HTTPS) {
    app.use(sslify.HTTPS({ trustProtoHeader: true }));
  }

  const frontendApp = getFrontendApp(robot);
  secureHeaders(app, frontendApp);
  app.use(frontendApp);
};
