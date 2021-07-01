describe('GitHub Actions', () => {
  describe('Create Branch', () => {
    it('should update Jira issue with link to a branch on GitHub', async () => {
      const payload = require('../fixtures/branch-basic.json');

      const jiraApi = td.api('https://test-atlassian-instance.net');
      const githubApi = td.api('https://api.github.com');

      const ref = 'TES-123-test-ref';
      const sha = 'test-branch-ref-sha';

      td.when(githubApi.get(`/repos/test-repo-owner/test-repo-name/git/ref/heads%2F${ref}`))
        .thenReturn({
          ref: 'refs/heads/test-ref',
          object: {
            sha,
          },
        });
      td.when(githubApi.get(`/repos/test-repo-owner/test-repo-name/commits/${sha}`))
        .thenReturn({
          commit: {
            author: {
              name: 'test-branch-author-name',
              date: 'test-branch-author-date',
            },
            message: 'test-commit-message',
          },
          html_url: `test-repo-url/commits/${sha}`,
        });

      Date.now = jest.fn(() => 12345678);

      await app.receive(payload);

      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: false,
        repositories: [
          {
            name: 'example/test-repo-name',
            url: 'test-repo-url',
            id: 'test-repo-id',
            branches: [
              {
                createPullRequestUrl: 'test-repo-url/pull/new/TES-123-test-ref',
                lastCommit: {
                  author: { name: 'test-branch-author-name' },
                  authorTimestamp: 'test-branch-author-date',
                  displayId: 'test-b',
                  fileCount: 0,
                  hash: 'test-branch-ref-sha',
                  id: 'test-branch-ref-sha',
                  issueKeys: ['TES-123'],
                  message: 'test-commit-message',
                  updateSequenceId: 12345678,
                  url: 'test-repo-url/commits/test-branch-ref-sha',
                },
                id: 'TES-123-test-ref',
                issueKeys: ['TES-123'],
                name: 'TES-123-test-ref',
                url: 'test-repo-url/tree/TES-123-test-ref',
                updateSequenceId: 12345678,
              },
            ],
            updateSequenceId: 12345678,
          },
        ],
        properties: {
          installationId: 1234,
        },
      }));
    });
    it('should not update Jira issue if there are no issue Keys in the branch name', async () => {
      const payload = require('../fixtures/branch-no-issues.json');
      const getLastCommit = jest.fn();

      await app.receive(payload);
      expect(getLastCommit).not.toBeCalled();
    });

    it('should exit early if ref_type is not a branch', async () => {
      const payload = require('../fixtures/branch-invalid-ref_type.json');
      const parseSmartCommit = jest.fn();

      await app.receive(payload);
      expect(parseSmartCommit).not.toBeCalled();
    });
  });

  describe('delete a branch', () => {
    it('should call the devinfo delete API when a branch is deleted', async () => {
      const payload = require('../fixtures/branch-delete.json');

      const jiraApi = td.api('https://test-atlassian-instance.net');

      Date.now = jest.fn(() => 12345678);
      await app.receive(payload);

      td.verify(jiraApi.delete('/rest/devinfo/0.10/repository/test-repo-id/branch/TES-123-test-ref?_updateSequenceId=12345678'));
    });
  });
});
