const { getLog } = require('../config/logger');

/*

This enhances the existing request logger, created by Probot.
https://github.com/probot/probot/blob/e20d3ce8f188f8266d6c1ab71aa245c110a0a26f/src/middleware/logging.ts

See an example of how to use this in your routes below. Once added, `userId` is included in subsequent log messages.

```
app.get('/foo', async (req, res) => {
  req.addLogFields({ userId: req.params.userId })
  req.log.info('Hello from foo') // INFO -- Hello from foo (userId=123)

  try {
    doThing()
    res.status(200)
  } catch (err) {
    req.log.error('An error occurred') // ERROR -- An error occurred (userId=123)
    res.status(500)
  }
})
```

*/
const logMiddleware = (req, res, next) => {
  req.addLogFields = function (fields) {
    if (this.log) {
      this.log = this.log.child(fields);
    } else {
      throw new Error(`No log found during request: ${req.method} ${req.path}`);
    }
  };
  let logger = getLog();
  req.log = req.log || logger;
  req.addLogFields({ requestId: req.header('X-Request-Id') });

  next();
};

module.exports = logMiddleware;
