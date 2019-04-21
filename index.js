const github = require('./lib/github');
const chalk = require('chalk');


const getUserPullIds = async (orgName, repoName, userName) => {
	const allPulls = await github.getRepo(orgName, repoName);
	const userPullIds = allPulls
		.filter(pr => pr.user.login == userName)
		.map(pr => pr.number);

	return userPullIds;
}

const getReviews = async (orgName, repoName, userName, pullId) => {
	const pull = await github.getReviews(orgName, repoName, pullId)
	return pull;
}

const mainLoop = async (repoName, author) => {
	const orgName = "Ada-C11";
	const prefix = `${chalk.magenta(author)} -> ${chalk.cyan(repoName)}`;

	// Get pulls for user
	const pullIds = await getUserPullIds(orgName, repoName, author);
	if (pullIds.length < 1) {
		console.log(`${prefix}: ${chalk.white("no pulls found")}`);
		return;
	}

	// Get reviews for PR
	const id = pullIds[0];
	const reviews = await getReviews(orgName, repoName, author, id);

	if (reviews.length < 1) {
		console.log(`${prefix}: ${chalk.bold.bgRed.white("needs review!")}`);
		console.log(chalk.white.bold.bgRed(`\thttps://github.com/${orgName}/${repoName}/pull/${id}/changes`));
		return;
	}

	// Check review status
	const review = reviews[0]
	console.log(`${prefix}: ${chalk.green("reviewed")}, status: ${review.state}`);

	return;
}

const main = async () => {
	reviewees = ['Kimberly-Fasbender', 'laneia', 'goblineer', 'kaseea'];
	repos = ['fibonacci', 'array_intersection'];

	for (const reviewee of reviewees) {
		for (const repo of repos) {
			await mainLoop(repo, reviewee);
		}
	}
}

main()
