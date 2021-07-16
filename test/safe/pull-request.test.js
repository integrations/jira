describe('GitHub Actions', () => {
  describe('pull_request', () => {
    it('should update the Jira issue with the linked GitHub pull_request', async () => {
      const payload = require('../fixtures/pull-request-basic.json');

      const jiraApi = td.api('https://test-atlassian-instance.net');
      const githubApi = td.api('https://api.github.com');

      td.when(githubApi.get('/users/test-pull-request-user-login')).thenReturn({
        login: 'test-pull-request-author-login',
        avatar_url: 'test-pull-request-author-avatar',
        html_url: 'test-pull-request-author-url',
      });

      td.when(githubApi.get('/repos/example/test-repo-name/pulls/1/commits')).thenReturn([]);

      td.when(jiraApi.get('/rest/api/latest/issue/TEST-123?fields=summary'))
        .thenReturn({
          key: 'TEST-123',
          fields: {
            summary: 'Example Issue',
          },
        });

      Date.now = jest.fn(() => 12345678);

      await app.receive(payload);

      td.verify(githubApi.patch('/repos/test-repo-owner/test-repo-name/issues/1', {
        body: '[TEST-123] body of the test pull request.\n\n[TEST-123]: https://test-atlassian-instance.net/browse/TEST-123',
        id: 'test-pull-request-id',
      }));

      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: false,
        repositories: [
          {
            name: 'example/test-repo-name',
            url: 'test-repo-url',
            id: 'test-repo-id',
            branches: [
              {
                createPullRequestUrl: 'test-pull-request-head-url/pull/new/TEST-321-test-pull-request-head-ref',
                lastCommit: {
                  author: {
                    name: 'test-pull-request-author-login',
                  },
                  authorTimestamp: 'test-pull-request-update-time',
                  displayId: 'test-p',
                  fileCount: 0,
                  hash: 'test-pull-request-sha',
                  id: 'test-pull-request-sha',
                  issueKeys: ['TEST-123', 'TEST-321'],
                  message: 'n/a',
                  updateSequenceId: 12345678,
                  url: 'test-pull-request-head-url/commit/test-pull-request-sha',
                },
                id: 'TEST-321-test-pull-request-head-ref',
                issueKeys: ['TEST-123', 'TEST-321'],
                name: 'TEST-321-test-pull-request-head-ref',
                url: 'test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref',
                updateSequenceId: 12345678,
              },
            ],
            pullRequests: [
              {
                author: {
                  name: 'test-pull-request-author-login',
                  avatar: 'test-pull-request-author-avatar',
                  url: 'test-pull-request-author-url',
                },
                commentCount: 'test-pull-request-comment-count',
                destinationBranch: 'test-pull-request-base-url/tree/test-pull-request-base-ref',
                displayId: '#1',
                id: 1,
                reviewers: [],
                issueKeys: ['TEST-123', 'TEST-321'],
                lastUpdate: 'test-pull-request-update-time',
                sourceBranch: 'TEST-321-test-pull-request-head-ref',
                sourceBranchUrl: 'test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref',
                status: 'OPEN',
                title: '[TEST-123] Test pull request.',
                timestamp: 'test-pull-request-update-time',
                url: 'test-pull-request-url',
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

    it('should not update the Jira issue if the source repo of a pull_request was deleted', async () => {
      const payload = require('../fixtures/pull-request-null-repo.json');

      const githubApi = td.api('https://api.github.com');

      td.when(githubApi.get('/users/test-pull-request-user-login')).thenReturn({
        login: 'test-pull-request-author-login',
        avatar_url: 'test-pull-request-author-avatar',
        html_url: 'test-pull-request-author-url',
      });

      td.when(githubApi.get('/repos/example/test-repo-name/pulls/test-pull-request-number/commits')).thenReturn([]);

      Date.now = jest.fn(() => 12345678);

      // should not throw
      await app.receive(payload);
    });

    it('should delete the reference to a pull request when issue keys are removed from the title', async () => {
      const payload = require('../fixtures/pull-request-remove-keys.json');
      const { repository, pull_request: pullRequest } = payload.payload;
      const githubApi = td.api('https://api.github.com');
      const jiraApi = td.api('https://test-atlassian-instance.net');

      td.when(githubApi.get('/users/test-pull-request-user-login')).thenReturn({
        login: 'test-pull-request-author-login',
        avatar_url: 'test-pull-request-author-avatar',
        html_url: 'test-pull-request-author-url',
      });

      td.when(githubApi.get('/repos/example/test-repo-name/pulls/1/commits')).thenReturn([]);

      Date.now = jest.fn(() => 12345678);

      await app.receive(payload);

      td.verify(jiraApi.delete(`/rest/devinfo/0.10/repository/${repository.id}/pull_request/${pullRequest.number}?_updateSequenceId=12345678`));
    });

    it('will not delete references if a branch still has an issue key', async () => {
      const payload = require('../fixtures/pull-request-test-changes-with-branch.json');

      const jiraApi = td.api('https://test-atlassian-instance.net');
      const githubApi = td.api('https://api.github.com');

      td.when(githubApi.get('/users/test-pull-request-user-login')).thenReturn({
        login: 'test-pull-request-author-login',
        avatar_url: 'test-pull-request-author-avatar',
        html_url: 'test-pull-request-author-url',
      });

      td.when(githubApi.get('/repos/example/test-repo-name/pulls/1/commits')).thenReturn([]);

      Date.now = jest.fn(() => 12345678);

      await app.receive(payload);

      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: false,
        repositories: [
          {
            id: 'test-repo-id',
            name: 'example/test-repo-name',
            url: 'test-repo-url',
            branches: [
              {
                createPullRequestUrl: 'TES-3-test-pull-request-head-url/pull/new/TES-3-test-pull-request-head-ref',
                lastCommit: {
                  author: { name: 'test-pull-request-author-login' },
                  authorTimestamp: 'test-pull-request-update-time',
                  displayId: 'test-p',
                  fileCount: 0,
                  hash: 'test-pull-request-sha',
                  id: 'test-pull-request-sha',
                  issueKeys: ['TES-3'],
                  message: 'n/a',
                  updateSequenceId: 12345678,
                  url: 'TES-3-test-pull-request-head-url/commit/test-pull-request-sha',
                },
                id: 'TES-3-test-pull-request-head-ref',
                issueKeys: ['TES-3'],
                name: 'TES-3-test-pull-request-head-ref',
                url: 'TES-3-test-pull-request-head-url/tree/TES-3-test-pull-request-head-ref',
                updateSequenceId: 12345678,
              },
            ],
            pullRequests: [
              {
                author: {
                  avatar: 'test-pull-request-author-avatar',
                  name: 'test-pull-request-author-login',
                  url: 'test-pull-request-author-url',
                },
                commentCount: 'test-pull-request-comment-count',
                destinationBranch: 'test-pull-request-base-url/tree/pull-request-base-ref',
                displayId: '#1',
                id: 1,
                reviewers: [],
                issueKeys: ['TES-3'],
                lastUpdate: 'test-pull-request-update-time',
                sourceBranch: 'TES-3-test-pull-request-head-ref',
                sourceBranchUrl: 'TES-3-test-pull-request-head-url/tree/TES-3-test-pull-request-head-ref',
                status: 'OPEN',
                timestamp: 'test-pull-request-update-time',
                title: 'Test pull request.',
                url: 'test-pull-request-url',
                updateSequenceId: 12345678,
              },
            ],
            updateSequenceId: 12345678,
          },
        ],
        properties: { installationId: 1234 },
      }));
    });

    it('should update the Jira issue with the linked GitHub pull_request if PR opened action was triggered by bot', async () => {
      const payload = require('../fixtures/pull-request-triggered-by-bot.json');

      const jiraApi = td.api('https://test-atlassian-instance.net');
      const githubApi = td.api('https://api.github.com');

      td.when(githubApi.get('/users/test-pull-request-user-login')).thenReturn({
        login: 'test-pull-request-author-login',
        avatar_url: 'test-pull-request-author-avatar',
        html_url: 'test-pull-request-author-url',
      });

      td.when(jiraApi.get('/rest/api/latest/issue/TEST-123?fields=summary'))
        .thenReturn({
          key: 'TEST-123',
          fields: {
            summary: 'Example Issue',
          },
        });

      Date.now = jest.fn(() => 12345678);

      await app.receive(payload[0]);

      td.verify(githubApi.patch('/repos/test-repo-owner/test-repo-name/issues/1', {
        body: '[TEST-123] body of the test pull request.\n\n[TEST-123]: https://test-atlassian-instance.net/browse/TEST-123',
        id: 'test-pull-request-id',
      }));

      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: false,
        repositories: [
          {
            name: 'example/test-repo-name',
            url: 'test-repo-url',
            id: 'test-repo-id',
            branches: [
              {
                createPullRequestUrl: 'test-pull-request-head-url/pull/new/TEST-321-test-pull-request-head-ref',
                lastCommit: {
                  author: {
                    name: 'test-pull-request-author-login',
                  },
                  authorTimestamp: 'test-pull-request-update-time',
                  displayId: 'test-p',
                  fileCount: 0,
                  hash: 'test-pull-request-sha',
                  id: 'test-pull-request-sha',
                  issueKeys: ['TEST-123', 'TEST-321'],
                  message: 'n/a',
                  updateSequenceId: 12345678,
                  url: 'test-pull-request-head-url/commit/test-pull-request-sha',
                },
                id: 'TEST-321-test-pull-request-head-ref',
                issueKeys: ['TEST-123', 'TEST-321'],
                name: 'TEST-321-test-pull-request-head-ref',
                url: 'test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref',
                updateSequenceId: 12345678,
              },
            ],
            pullRequests: [
              {
                author: {
                  name: 'test-pull-request-author-login',
                  avatar: 'test-pull-request-author-avatar',
                  url: 'test-pull-request-author-url',
                },
                commentCount: 'test-pull-request-comment-count',
                destinationBranch: 'test-pull-request-base-url/tree/test-pull-request-base-ref',
                displayId: '#1',
                id: 1,
                reviewers: [],
                issueKeys: ['TEST-123', 'TEST-321'],
                lastUpdate: 'test-pull-request-update-time',
                sourceBranch: 'TEST-321-test-pull-request-head-ref',
                sourceBranchUrl: 'test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref',
                status: 'OPEN',
                title: '[TEST-123] Test pull request.',
                timestamp: 'test-pull-request-update-time',
                url: 'test-pull-request-url',
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

    it('should update the Jira issue with the linked GitHub pull_request if PR closed action was triggered by bot', async () => {
      const payload = require('../fixtures/pull-request-triggered-by-bot.json');

      const jiraApi = td.api('https://test-atlassian-instance.net');
      const githubApi = td.api('https://api.github.com');

      td.when(githubApi.get('/users/test-pull-request-user-login')).thenReturn({
        login: 'test-pull-request-author-login',
        avatar_url: 'test-pull-request-author-avatar',
        html_url: 'test-pull-request-author-url',
      });

      td.when(jiraApi.get('/rest/api/latest/issue/TEST-123?fields=summary'))
        .thenReturn({
          key: 'TEST-123',
          fields: {
            summary: 'Example Issue',
          },
        });

      Date.now = jest.fn(() => 12345678);

      await app.receive(payload[1]);

      td.verify(githubApi.patch('/repos/test-repo-owner/test-repo-name/issues/1', {
        body: '[TEST-123] body of the test pull request.\n\n[TEST-123]: https://test-atlassian-instance.net/browse/TEST-123',
        id: 'test-pull-request-id',
      }));

      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: false,
        repositories: [
          {
            name: 'example/test-repo-name',
            url: 'test-repo-url',
            id: 'test-repo-id',
            branches: [],
            pullRequests: [
              {
                author: {
                  name: 'test-pull-request-author-login',
                  avatar: 'test-pull-request-author-avatar',
                  url: 'test-pull-request-author-url',
                },
                commentCount: 'test-pull-request-comment-count',
                destinationBranch: 'test-pull-request-base-url/tree/test-pull-request-base-ref',
                displayId: '#1',
                id: 1,
                reviewers: [],
                issueKeys: ['TEST-123', 'TEST-321'],
                lastUpdate: 'test-pull-request-update-time',
                sourceBranch: 'TEST-321-test-pull-request-head-ref',
                sourceBranchUrl: 'test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref',
                status: 'MERGED',
                title: '[TEST-123] Test pull request.',
                timestamp: 'test-pull-request-update-time',
                url: 'test-pull-request-url',
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

    it('should update the Jira issue with the linked GitHub pull_request if PR reopened action was triggered by bot', async () => {
      const payload = require('../fixtures/pull-request-triggered-by-bot.json');

      const jiraApi = td.api('https://test-atlassian-instance.net');
      const githubApi = td.api('https://api.github.com');

      td.when(githubApi.get('/users/test-pull-request-user-login')).thenReturn({
        login: 'test-pull-request-author-login',
        avatar_url: 'test-pull-request-author-avatar',
        html_url: 'test-pull-request-author-url',
      });

      td.when(jiraApi.get('/rest/api/latest/issue/TEST-123?fields=summary'))
        .thenReturn({
          key: 'TEST-123',
          fields: {
            summary: 'Example Issue',
          },
        });

      Date.now = jest.fn(() => 12345678);

      await app.receive(payload[2]);

      td.verify(githubApi.patch('/repos/test-repo-owner/test-repo-name/issues/1', {
        body: '[TEST-123] body of the test pull request.\n\n[TEST-123]: https://test-atlassian-instance.net/browse/TEST-123',
        id: 'test-pull-request-id',
      }));

      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: false,
        repositories: [
          {
            name: 'example/test-repo-name',
            url: 'test-repo-url',
            id: 'test-repo-id',
            branches: [
              {
                createPullRequestUrl: 'test-pull-request-head-url/pull/new/TEST-321-test-pull-request-head-ref',
                lastCommit: {
                  author: {
                    name: 'test-pull-request-author-login',
                  },
                  authorTimestamp: 'test-pull-request-update-time',
                  displayId: 'test-p',
                  fileCount: 0,
                  hash: 'test-pull-request-sha',
                  id: 'test-pull-request-sha',
                  issueKeys: ['TEST-123', 'TEST-321'],
                  message: 'n/a',
                  updateSequenceId: 12345678,
                  url: 'test-pull-request-head-url/commit/test-pull-request-sha',
                },
                id: 'TEST-321-test-pull-request-head-ref',
                issueKeys: ['TEST-123', 'TEST-321'],
                name: 'TEST-321-test-pull-request-head-ref',
                url: 'test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref',
                updateSequenceId: 12345678,
              },
            ],
            pullRequests: [
              {
                author: {
                  name: 'test-pull-request-author-login',
                  avatar: 'test-pull-request-author-avatar',
                  url: 'test-pull-request-author-url',
                },
                commentCount: 'test-pull-request-comment-count',
                destinationBranch: 'test-pull-request-base-url/tree/test-pull-request-base-ref',
                displayId: '#1',
                id: 1,
                reviewers: [],
                issueKeys: ['TEST-123', 'TEST-321'],
                lastUpdate: 'test-pull-request-update-time',
                sourceBranch: 'TEST-321-test-pull-request-head-ref',
                sourceBranchUrl: 'test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref',
                status: 'OPEN',
                title: '[TEST-123] Test pull request.',
                timestamp: 'test-pull-request-update-time',
                url: 'test-pull-request-url',
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

    it('should have reviewers on pull request action', async () => {
      const payload = require('../fixtures/pull-request-basic.json');

      const jiraApi = td.api('https://test-atlassian-instance.net');
      const githubApi = td.api('https://api.github.com');

      td.when(githubApi.get('/users/test-pull-request-user-login')).thenReturn({
        login: 'test-pull-request-author-login',
        avatar_url: 'test-pull-request-author-avatar',
        html_url: 'test-pull-request-author-url',
      });

      td.when(githubApi.get('/repos/test-repo-owner/test-repo-name/pulls/1/reviews')).thenReturn([
        {
          id: 80,
          node_id: 'MDE3OlB1bGxSZXF1ZXN0UmV2aWV3ODA=',
          user: {
            login: 'test-pull-request-reviewer-login',
            id: 1,
            node_id: 'MDQ6VXNlcjE=',
            avatar_url: 'test-pull-request-reviewer-avatar',
            gravatar_id: '',
            url: 'https://api.github.com/users/reviewer',
            html_url: 'https://github.com/reviewer',
            followers_url: 'https://api.github.com/users/reviewer/followers',
            following_url: 'https://api.github.com/users/reviewer/following{/other_user}',
            gists_url: 'https://api.github.com/users/reviewer/gists{/gist_id}',
            starred_url: 'https://api.github.com/users/reviewer/starred{/owner}{/repo}',
            subscriptions_url: 'https://api.github.com/users/reviewer/subscriptions',
            organizations_url: 'https://api.github.com/users/reviewer/orgs',
            repos_url: 'https://api.github.com/users/reviewer/repos',
            events_url: 'https://api.github.com/users/reviewer/events{/privacy}',
            received_events_url: 'https://api.github.com/users/reviewer/received_events',
            type: 'User',
            site_admin: false,
          },
          body: 'Here is the body for the review.',
          state: 'APPROVED',
          html_url: 'https://github.com/test-repo-owner/test-repo-name/pull/1#pullrequestreview-80',
          pull_request_url: 'https://api.github.com/repos/test-repo-owner/test-repo-name/pulls/1',
          _links: {
            html: {
              href: 'https://github.com/test-repo-owner/test-repo-name/pull/1#pullrequestreview-80',
            },
            pull_request: {
              href: 'https://api.github.com/repos/test-repo-owner/test-repo-name/pulls/1',
            },
          },
          submitted_at: '2019-11-17T17:43:43Z',
          commit_id: 'ecdd80bb57125d7ba9641ffaa4d7d2c19d3f3091',
          author_association: 'COLLABORATOR',
        },
      ]);

      td.when(jiraApi.get('/rest/api/latest/issue/TEST-123?fields=summary'))
        .thenReturn({
          key: 'TEST-123',
          fields: {
            summary: 'Example Issue',
          },
        });

      Date.now = jest.fn(() => 12345678);

      await app.receive(payload);

      td.verify(githubApi.patch('/repos/test-repo-owner/test-repo-name/issues/1', {
        body: '[TEST-123] body of the test pull request.\n\n[TEST-123]: https://test-atlassian-instance.net/browse/TEST-123',
        id: 'test-pull-request-id',
      }));

      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: false,
        repositories: [
          {
            name: 'example/test-repo-name',
            url: 'test-repo-url',
            id: 'test-repo-id',
            branches: [
              {
                createPullRequestUrl: 'test-pull-request-head-url/pull/new/TEST-321-test-pull-request-head-ref',
                lastCommit: {
                  author: {
                    name: 'test-pull-request-author-login',
                  },
                  authorTimestamp: 'test-pull-request-update-time',
                  displayId: 'test-p',
                  fileCount: 0,
                  hash: 'test-pull-request-sha',
                  id: 'test-pull-request-sha',
                  issueKeys: ['TEST-123', 'TEST-321'],
                  message: 'n/a',
                  updateSequenceId: 12345678,
                  url: 'test-pull-request-head-url/commit/test-pull-request-sha',
                },
                id: 'TEST-321-test-pull-request-head-ref',
                issueKeys: ['TEST-123', 'TEST-321'],
                name: 'TEST-321-test-pull-request-head-ref',
                url: 'test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref',
                updateSequenceId: 12345678,
              },
            ],
            pullRequests: [
              {
                author: {
                  name: 'test-pull-request-author-login',
                  avatar: 'test-pull-request-author-avatar',
                  url: 'test-pull-request-author-url',
                },
                commentCount: 'test-pull-request-comment-count',
                destinationBranch: 'test-pull-request-base-url/tree/test-pull-request-base-ref',
                displayId: '#1',
                id: 1,
                reviewers: [{
                  name: 'test-pull-request-reviewer-login',
                  approvalStatus: 'APPROVED',
                  url: 'https://github.com/reviewer',
                  avatar: 'test-pull-request-reviewer-avatar',
                }],
                issueKeys: ['TEST-123', 'TEST-321'],
                lastUpdate: 'test-pull-request-update-time',
                sourceBranch: 'TEST-321-test-pull-request-head-ref',
                sourceBranchUrl: 'test-pull-request-head-url/tree/TEST-321-test-pull-request-head-ref',
                status: 'OPEN',
                title: '[TEST-123] Test pull request.',
                timestamp: 'test-pull-request-update-time',
                url: 'test-pull-request-url',
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
  });
});
