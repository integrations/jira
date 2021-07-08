import GithubAPI from "../config/github-api";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { App } from "@octokit/app";
import { GitHubAPI } from "probot";
import bunyan from 'bunyan';

export default (octokitApp: App): RequestHandler => (req: Request, res: Response, next: NextFunction): void => {
  if (req.session.githubToken) {
    res.locals.github = GithubAPI({
      auth: req.session.githubToken
    });
  } else {
    res.locals.github = GithubAPI();
  }

  res.locals.client = GithubAPI({
    auth: octokitApp.getSignedJsonWebToken()
  });
  res.locals.isAdmin = isAdmin(res.locals.github);

  next();
};

// TODO: change function name as we're not looking for admin, but those that can install app in orga
export const isAdmin = (githubClient: GitHubAPI) =>
  async (args: { org: string, username: string, type: string }): Promise<boolean> => {
    const { org, username, type } = args;
    const logger = bunyan.createLogger({ name: 'GitHub Client Middleware' });

    // If this is a user installation, the "admin" is the user that owns the repo
    if (type === "User") {
      return org === username;
    }

    // Otherwise this is an Organization installation and we need to ask GitHub for role of the logged in user
    try {
      const {
        data: { role }
      } = await githubClient.orgs.getMembership({ org, username });
      return role === "admin";
    } catch (err) {
      logger.error(`${org} has not accepted new permission for getOrgMembership or has not entered the required IP addresses into the IP allow list - error: ${err}`);
      return false;
    }
  };


