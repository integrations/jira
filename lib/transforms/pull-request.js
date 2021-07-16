const parseSmartCommit = require('./smart-commit');
const { getJiraId } = require('../jira/util/id');
const _ = require('lodash');

function mapStatus({ state, merged }) {
  if (state === 'merged') {
    return 'MERGED';
  } else if (state === 'open') {
    return 'OPEN';
  } else if (state === 'closed' && merged) {
    return 'MERGED';
  } else if (state === 'closed' && !merged) {
    return 'DECLINED';
  } else {
    return 'UNKNOWN';
  }
}

function mapReviews(reviews) {
  reviews = reviews || [];
  const sortedReviews = _.orderBy(reviews, 'submitted_at', 'desc');
  const usernames = {};
  // The reduce function goes through all the reviews and creates an array of unique users (so users' avatars won't be duplicated on the dev panel in Jira) and it considers 'APPROVED' as the main approval status for that user.
  return sortedReviews.reduce((acc, review) => {
    // Adds user to the usernames object if user is not yet added, then it adds that unique user to the accumulator.
    if (!usernames[review.user.login]) {
      usernames[review.user.login] = {
        name: review.user.login,
        approvalStatus: review.state === 'APPROVED' ? 'APPROVED' : 'UNAPPROVED',
        url: review.user.html_url,
        avatar: review.user.avatar_url,
      };
      acc.push(usernames[review.user.login]);
      // If user is already added (not unique) but the previous approval status is different than APPROVED and current approval status is APPROVED, updates approval status.
    } else if (usernames[review.user.login].approvalStatus !== 'APPROVED' && review.state === 'APPROVED') {
      usernames[review.user.login].approvalStatus = 'APPROVED';
    }
    // Returns the reviews' array with unique users
    return acc;
  }, []);
}

module.exports = (payload, author, reviews, commits) => {
  // eslint-disable-next-line camelcase
  const { pull_request, repository } = payload;
  // Put together messages
  const messages = commits.map(c => c.commit.message).join('\n');
  // This is the same thing we do in sync, concatenating these values
  const { issueKeys } = parseSmartCommit(`${pull_request.title}\n${pull_request.head.ref}\n${messages}`);

  if (!issueKeys || !pull_request.head.repo) {
    return { data: undefined };
  }

  const pullRequestStatus = mapStatus(pull_request);

  let data = {
    data: {
      id: repository.id,
      name: repository.full_name,
      url: repository.html_url,
      branches: [
        {
          createPullRequestUrl: `${pull_request.head.repo.html_url}/pull/new/${pull_request.head.ref}`,
          lastCommit: {
            author: {
              name: author.login,
            },
            authorTimestamp: pull_request.updated_at,
            displayId: pull_request.head.sha.substring(0, 6),
            fileCount: 0,
            hash: pull_request.head.sha,
            id: pull_request.head.sha,
            issueKeys,
            message: 'n/a',
            updateSequenceId: Date.now(),
            url: `${pull_request.head.repo.html_url}/commit/${pull_request.head.sha}`,
          },
          id: getJiraId(pull_request.head.ref),
          issueKeys,
          name: pull_request.head.ref,
          url: `${pull_request.head.repo.html_url}/tree/${pull_request.head.ref}`,
          updateSequenceId: Date.now(),
        },
      ],
      pullRequests: [
        {
          author: {
            avatar: author.avatar_url,
            name: author.login,
            url: author.html_url,
          },
          commentCount: pull_request.comments,
          destinationBranch: `${pull_request.base.repo.html_url}/tree/${pull_request.base.ref}`,
          displayId: `#${pull_request.number}`,
          id: pull_request.number,
          issueKeys,
          lastUpdate: pull_request.updated_at,
          reviewers: mapReviews(reviews),
          sourceBranch: pull_request.head.ref,
          sourceBranchUrl: `${pull_request.head.repo.html_url}/tree/${pull_request.head.ref}`,
          status: pullRequestStatus,
          timestamp: pull_request.updated_at,
          title: pull_request.title,
          url: pull_request.html_url,
          updateSequenceId: Date.now(),
        },
      ],
      updateSequenceId: Date.now(),
    },
  };

  // Do not send the branch on the payload when the Pull Request Merged event is called.
  // Reason: If "Automatically delete head branches" is enabled, the branch deleted and PR merged events might be sent out “at the same time” and received out of order, which causes the branch being created again.
  if (pullRequestStatus === 'MERGED') {
    data.data.branches = [];
  }

  return data;
};
