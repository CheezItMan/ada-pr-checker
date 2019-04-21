const axios = require('axios');
const fs = require('fs');
const path = require('path');

const cacheDir = path.join(path.dirname(__dirname), '/cache');

// TODO use @octokit/rest
exports.getRepo = async (orgName, repoName) => {
	// Validate input (for security)
	__validateOrgName(orgName);
	__validateRepoName(repoName);

	// Check for cache
	cacheFileName = path.join(cacheDir, `.gc_repos_${orgName}_${repoName}`);
	if (fs.existsSync(cacheFileName)) {
		const jsonStr = fs.readFileSync(cacheFileName).toString();
		return JSON.parse(jsonStr);
	}

	// Get data from GitHub
	const url = `https://api.github.com/repos/${orgName}/${repoName}/pulls`;
	const {data} = await axios.get(url).catch((err) => {
		console.error('Failed fetching URL: ', url);
		return Promise.reject(err);
	});

	// Cache in filesystem
	fs.writeFileSync(cacheFileName, JSON.stringify(data));

	return data;
}

// TODO use @octokit/rest
exports.getReviews = async (orgName, repoName, pullId) => {
	// Validate input (for security)
	__validateOrgName(orgName);
	__validateRepoName(repoName);

	// Check for cache
	cacheFileName = path.join(cacheDir, `.gc_reviews_${orgName}_${repoName}_${pullId}`);
	if (fs.existsSync(cacheFileName)) {
		const jsonStr = fs.readFileSync(cacheFileName).toString();
		return JSON.parse(jsonStr);
	}

	// Get data from GitHub
	const url = `https://api.github.com/repos/${orgName}/${repoName}/pulls/${pullId}/reviews`;
	const {data} = await axios.get(url).catch((err) => {
		console.error('Failed fetching URL: ', url);
		return Promise.reject(err);
	});

	// Cache in filesystem
	fs.writeFileSync(cacheFileName, JSON.stringify(data));

	return data;
}

// Validators
const __validateOrgName = (orgName) => {
	if (!orgName || !orgName.match(/^Ada-C\d+$/g)) {
		throw "Invalid orgName";
	}
}

const __validateRepoName = (repoName) => {
	if (!repoName || !repoName.match(/^(\w|-|_)+$/ig)) {
		throw "Invalid repoName";
	}
}

const __validatePullId = (pullId) => {
	return !isNaN(pullId);
}
