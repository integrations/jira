## Contributing

[code-of-conduct]: CODE_OF_CONDUCT.md
[license]: LICENSE

[configure-github-app]: https://probot.github.io/docs/development/#configuring-a-github-app
[jira-developer-instance]: https://developer.atlassian.com/platform/marketplace/getting-started/#free-developer-instances-to-build-and-test-your-app
[style]: https://standardjs.com/
[releases]: https://help.github.com/articles/github-terms-of-service/#6-contributions-under-repository-license

Hi there! We're thrilled that you'd like to contribute to this project. Your help is essential for keeping it great.

## Notices
Contributions to this product are [released][releases] to the public under the [project's open source license][license].

Please note that this project is released with a [Contributor Code of Conduct][code-of-conduct]. By participating in this project you agree to abide by its terms.

## Getting Started

Please ensure that you have [homebrew](https://brew.sh/) installed. Instructions for setting this application up on an OS other than OSX are currently not outlined.

This app is written in [ES6 JavaScript](https://nodejs.org/en/docs/es6/) and runs on [Node.js](https://nodejs.org/). After cloning the repository, install the dependencies by running:

## Installing a tunneling tool

To allow your Jira instance to communicate with your locally running instance of the server, you need to have either ngrok or localtunnel installed.

Install ngrok:
```
brew cask install ngrok
```

Or install localtunnel:
```
npm install -g localtunnel
```

A tunnel will automatically be created using one of the installed tools when you later start the server (see `tunnel.js`). This tunnel will expose a URL through which internet traffic can reach your local machine. This URL will be called `DOMAIN` in the rest of this document.

## Configuring a GitHub App

Create a new [GitHub App](https://github.com/settings/apps), setting the following config:

- **GitHub App name**: Anything you want, but it must be unique across GitHub. `E.g. my-test-app`
- **Homepage URL**: `https://github.com/apps/my-test-app`
- **Callback URL**: `https://DOMAIN/github/callback`
- **Setup URL**: `https://DOMAIN/github/setup`
- **Webhook URL**: `https://DOMAIN/github/events`
- **Webhook Secret**: `development`

Your new GitHub app will need the following repository permissions:

+ Contents: Read & write
+ Issues: Read & write
+ Metadata: Read-only
+ Pull requests: Read & write

It will also need to subscribe to the following events:

+ Commit comment
+ Create
+ Delete
+ Issue comment
+ Issues
+ Pull request
+ Pull request review
+ Push

## Setting up your `.env` file

Once you've set up your GitHub app and cloned this repo, copy the content from `.env.example` and paste it to a new file called `.env`, with the following configuration:

+ `APP_ID` and `GITHUB_CLIENT_ID`: Copy these values over from your new GitHub app page.
+ `APP_URL`: `https://DOMAIN`
+ `GITHUB_CLIENT_SECRET`: You'll need to generate a new one on your GitHub app page by hitting the `Generate a new client secret` button. Copy and paste the generated secret.
+ `TUNNEL_SUBDOMAIN`: the subdomain you want to use to allow access from the internet to your local machine (just replace &lt;yourname&gt; with your name)
+ `PRIVATE_KEY_PATH`: You'll also need to generate a new private key on your GitHub app page, download it, move it to the source root of this repo, and set `PRIVATE_KEY_PATH=<your-private-key-name>.pem`
+ `ATLASSIAN_URL`: The URL for the Jira instance you're testing it. If you don't have one now, please set the value of this variable after going through the step 1 of "Configuring the Jira instance" section of this document.
+ `STORAGE_SECRET`: It needs to be set to a 32 char secret (anything else fails). You can generate one by running `openssl rand -hex 32 | pbcopy` in your terminal and paste directly to your .env file.
+ `INSTANCE_NAME`: choose a name for your instance
+ `WEBHOOK_PROXY_URL`: `https://DOMAIN/github/events`

## Running dependencies

Please ensure that you have [homebrew](https://brew.sh/) installed. Instructions for setting this application up on an OS other than OSX are currently not outlined.

This app is written in [ES6 JavaScript](https://nodejs.org/en/docs/es6/) and runs on [Node.js](https://nodejs.org/).

**Required version of Node**: v12.x

Install the dependencies by running:

```
$ script/bootstrap
```

This will install all dependencies, including `node` and `postgres`, which are required to run the app. However, we recommend running `postgres` and `redis` in docker instead of doing it locally. You can do so by running: `docker-compose up`.

**Note:** Most certainly, if you are running Postgres in docker, it won’t have any info about your local user, so the superuser will be named postgres instead of having the same name as your Mac user. You can fix this by:
* Open db/config.json
* Add "username": "postgres", inside "development" and "test".
* Be careful to not commit the changes in this file!

To set up the databases and keep their schemas up to date, run:

```
$ script/db_create
```

You can verify that your code is set up correctly by running:

```
$ npm test
```


#### Running the application

When you are developing you will prefer to run the app and automatically restart it when you do changes to the source code. In that case you should use:

```
$ script/server
```

For production, you should just use `npm run start`.

Note: The free version of ngrok does not support subdomains. You will need to clear the value of `TUNNEL_SUBDOMAIN` and comment out the logic in the `script/tunnel` file that checks if `TUNNEL_SUBDOMAIN` is set. `script/server` will also spin up it's own ngrok url, so you will need to use the logged url to configure your github application. Look for a log in your terminal with a message of "started tunnel". It'll have a `url` property containing the ngrok generated url. 


## Configuring the Jira instance

1. Create a new [free developer instance][jira-developer-instance] on Jira Cloud.
2. From the header menu, select **Apps** -> **Manage your apps**.
3. Verify the filter is set to `User-installed`, and select **Settings** beneath the User-installed apps table.
4. On the Settings pop-up, add **Enable development mode** and click **Apply**. Refresh the page.
5. On the right side of the header, there should now appear a button **Upload app**. Click it and enter `https://DOMAIN/jira/atlassian-connect.json`
6. Click **Upload**.
7. That's it! You're done. :tada:

## Submitting a pull request

1. [Fork](https://reflectoring.io/github-fork-and-pull/) and clone the repository.
1. Configure and install the dependencies: `npm install`
1. Make sure the tests pass on your machine: `npm test`, note: these tests also apply the linter, so no need to lint separately
1. Create a new branch: `git checkout -b my-branch-name`
1. Make your change, add tests, and make sure the tests still pass
1. Push to your fork and submit a pull request
1. Pat your self on the back and wait for your pull request to be reviewed and merged.

Here are a few things you can do that will increase the likelihood of your pull request being accepted:

- Follow the [style guide][style] which is using standard. Any linting errors should be shown when running `npm test`
- Write and update tests.
- Keep your change as focused as possible. If there are multiple changes you would like to make that are not dependent upon each other, consider submitting them as separate pull requests.
- Write a [good commit message](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html).

Work in Progress pull request are also welcome to get feedback early on, or if there is something blocking you.

## Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [GitHub Help](https://help.github.com)
