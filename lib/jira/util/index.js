module.exports = function (jiraClient) {
  const containsReferenceLink = (line) => {
    // reference text links should have 2 parts only
    if (line.split(' ').length === 2) {
      const hasSquareBrackets = line.charAt(0) === '[' && line.includes(']:');
      const hasUrl = line.includes('http://') || line.includes('https://');

      return hasSquareBrackets && hasUrl;
    }

    return false;
  };

  // Parse our existing issue text, pulling out any existing reference links.
  // if reference links exist, returns array of issue keys. For example, the following
  // reference links would return [ 'TEST-2019', 'TEST-2020' ]
  // [TEST-2019]: http://example.com/browse/TEST-2019
  // [TEST-2020]: https://example.com/browse/TEST-2020
  // if no issue keys exist, return []
  const checkForReferenceText = (text) => {
    const splitTextByNewLine = text.split('\n');

    return splitTextByNewLine
      .filter((line) => containsReferenceLink(line))
      .map((referenceLink) => referenceLink.slice(1, referenceLink.indexOf(']')));
  };

  function addJiraIssueLinks(text, issues) {
    const referenceRegex = /\[([A-Z0-9]+-[0-9]+)\](?!\()/g;
    const issueMap = issues.reduce((issueMap, issue) => ({
      ...issueMap,
      [issue.key]: issue,
    }), {});

    const links = [];
    const keys = checkForReferenceText(text);

    // Parse the text up to a maximum amount of characters.
    while (referenceRegex.lastIndex < 1000) {
      const match = referenceRegex.exec(text);

      if (!match) {
        break;
      }

      const [, key] = match;
      // If we already have a reference link, or the issue is not valid, skip it.
      if (keys.includes(key) || !issueMap[key]) {
        continue;
      }

      const link = `${jiraClient.baseURL}/browse/${key}`;
      const reference = `[${key}]: ${link}`;

      if (text.includes(reference)) {
        continue;
      }

      links.push(reference);
    }

    return links.length ? [text, links.join('\n')].join('\n\n') : text;
  }

  async function unfurl(text) {
    const issues = jiraClient.issues.parse(text);
    if (!issues) return;

    const validIssues = await jiraClient.issues.getAll(issues);
    if (!validIssues.length) return;

    const linkifiedBody = await addJiraIssueLinks(text, validIssues);
    if (linkifiedBody === text) return;

    return linkifiedBody;
  }

  async function runJiraCommands(commands) {
    return Promise.all(commands.map(command => {
      if (command.kind === 'comment') {
        return Promise.all(command.issueKeys.map(issueKey => jiraClient.issues.comments.addForIssue(issueKey, {
          body: command.text,
        })));
      }

      if (command.kind === 'worklog') {
        return Promise.all(command.issueKeys.map(issueKey => jiraClient.issues.worklogs.addForIssue(issueKey, {
          timeSpentSeconds: command.time,
          comment: command.text,
        })));
      }

      if (command.kind === 'transition') {
        return Promise.all(command.issueKeys.map(async issueKey => {
          const transitions = (await jiraClient.issues.transitions.getForIssue(issueKey))
            .data
            .transitions
            .map(transition => ({
              id: transition.id,
              name: transition.name.replace(' ', '-').toLowerCase(),
            }))
            .filter(transition => transition.name.startsWith(command.name));

          // We only want to run a transition if we match only one. If we don't match a transition
          // or if we match two transitions, we should resolve rather than transitioning.
          if (transitions.length !== 1) {
            return Promise.resolve();
          }

          if (command.text) {
            await jiraClient.issues.comments.addForIssue(issueKey, {
              body: command.text,
            });
          }

          return jiraClient.issues.transitions.updateForIssue(issueKey, transitions[0].id);
        }));
      }
    }));
  }

  return {
    addJiraIssueLinks,
    runJiraCommands,
    unfurl,
  };
};
