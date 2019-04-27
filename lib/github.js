`use strict`;

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const config = require('../config.json');

const AUTH_TOKEN = config.githubAuthToken;
const CACHE_DIR = path.join(path.dirname(__dirname), '/cache');

const _shouldUseCache = (file, minTime) => {
  return fs.existsSync(file) && minTime < fs.statSync(file).mtime;
};

// TODO use @octokit/rest
exports.getRepo = async (orgName, repoName, minCacheTime) => {
  // Validate input (for security)
  __validateOrgName(orgName);
  __validateRepoName(repoName);
  __validateCacheDirExists();
  __validateAuthToken(AUTH_TOKEN);

  // Check for cache
  const cacheFileName = path.join(
    CACHE_DIR,
    `.gc_repos_${orgName}_${repoName}`
  );
  if (_shouldUseCache(cacheFileName, minCacheTime)) {
    const jsonStr = fs.readFileSync(cacheFileName).toString();
    return JSON.parse(jsonStr);
  }

  // Get data from GitHub
  const url = `https://api.github.com/repos/${orgName}/${repoName}/pulls?per_page=100`;
  const headers = {headers: {Authorization: 'token ' + AUTH_TOKEN}};
  const {data} = await axios.get(url, headers).catch(err => {
    console.error('Failed fetching URL: ', url);
    if (err.response && err.response.status === 403) {
      return Promise.reject(
        new Error("You're rate-limited. Specify an auth token in config.json?")
      );
    }
    return Promise.reject(err);
  });

  // Cache in filesystem
  fs.writeFileSync(cacheFileName, JSON.stringify(data));

  return data;
};

// TODO use @octokit/rest
exports.getReviews = async (orgName, repoName, pullId, minCacheTime) => {
  // Validate input (for security)
  __validateOrgName(orgName);
  __validateRepoName(repoName);
  __validatePullId(pullId);
  __validateCacheDirExists();
  __validateAuthToken(AUTH_TOKEN);

  // Check for cache
  const cacheFileName = path.join(
    CACHE_DIR,
    `.gc_reviews_${orgName}_${repoName}_${pullId}`
  );
  if (_shouldUseCache(cacheFileName, minCacheTime)) {
    const jsonStr = fs.readFileSync(cacheFileName).toString();
    return JSON.parse(jsonStr);
  }

  // Get data from GitHub
  const url = `https://api.github.com/repos/${orgName}/${repoName}/pulls/${pullId}/reviews`;
  const headers = {headers: {Authorization: 'token ' + AUTH_TOKEN}};
  const {data} = await axios.get(url, headers).catch(err => {
    console.error('Failed fetching URL: ', url);
    return Promise.reject(err);
  });

  // Cache in filesystem
  fs.writeFileSync(cacheFileName, JSON.stringify(data));

  return data;
};

// Validators
const __validateOrgName = orgName => {
  if (!orgName || !orgName.match(/^Ada-C\d+$/g)) {
    throw new Error(
      'Invalid GitHub org name. GitHub org names must be of format "Ada-C#"'
    );
  }
};

const __validateRepoName = repoName => {
  if (!repoName || !repoName.match(/^(\w|-|_)+$/gi)) {
    throw new Error('Invalid GitHub repo name.');
  }
};

const __validatePullId = pullId => {
  if (isNaN(pullId) || parseInt(pullId) < 1) {
    throw new Error(
      `Invalid GitHub pull ID: ${pullId}. Pull IDs must be positive integers.`
    );
  }
};

const __validateCacheDirExists = () => {
  if (!fs.existsSync(CACHE_DIR)) {
    console.log(`Cache directory missing; creating ${CACHE_DIR}`);
    fs.mkdirSync(CACHE_DIR, {recursive: true});
  }
};

const __validateAuthToken = token => {
  if (token && !token.match(/^(\d|[a-f])+$/gi)) {
    throw new Error(
      'Invalid GitHub auth token. Auth tokens, when provided, must be in hexadecimal format.'
    );
  }
};
