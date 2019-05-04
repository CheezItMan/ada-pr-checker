`use strict`;

const proxyquire = require('proxyquire')
  .noPreserveCache()
  .noCallThru();
const test = require('ava');
const sinon = require('sinon');
const chalk = require('chalk');

const realMoment = require('moment');

const getProgram = (configValues, momentTime, parseDateTime) => {
  // Pre-intialized values
  const repoData = [
    {
      number: 1,
      user: {login: 'target_user'},
    },
    {
      number: 2,
      user: {login: 'other_user'},
    },
  ];
  const reviewsData = [{state: 'STATE_A'}, {state: 'STATE_B'}];

  // Default values
  configValues = Object.assign(
    {
      githubAuthors: ['target_user'],
      githubOrg: 'Ada-C11',
      cacheExpiry: '5 minutes',
      allGithubRepos: ['repo_1', 'repo_2'],
    },
    configValues || {}
  );
  parseDateTime = parseDateTime || new Date();
  momentTime = momentTime || new Date();

  // Clone values (to prevent cross-test issues)
  configValues = JSON.parse(JSON.stringify(configValues));

  const configstoreMock = {
    get: sinon.stub().callsFake(x => configValues[x]),
    set: sinon.stub().callsFake((x, y) => {
      configValues[x] = y;
    }),
  };

  const githubLibMock = {
    getRepo: sinon.stub().resolves(repoData),
    getReviews: sinon.stub().resolves(reviewsData),
  };

  const chronoMock = {
    parseDate: sinon.stub().returns(parseDateTime),
  };

  const proxyMoment = sinon.stub();
  proxyMoment.withArgs(sinon.match.string).callsFake(realMoment);

  // moment()'s are mutable, so return a new one each time
  proxyMoment.withArgs().callsFake(() => realMoment(momentTime));

  const consoleMock = {
    log: sinon.stub(),
    error: console.error,
  };

  const mocks = {
    './lib/github': githubLibMock,
    libGithub: githubLibMock,
    configstore: sinon.stub().returns(configstoreMock),
    configstoreMock: configstoreMock,
    config: configValues,
    'chrono-node': chronoMock,
    chrono: chronoMock,
    moment: proxyMoment,
    console: consoleMock,
  };

  // Make a new instance of index.js with each cli.parse call
  // yargs doesn't handle multiple cli.parse calls per instance well
  const makeCli = () => proxyquire('../index.js', mocks).cli;

  return {
    makeCli,
    mocks,
  };
};

/* Config options */
test('should import settings from config', async t => {
  const config = {
    githubAuthors: ['target_user'],
    githubOrg: 'Ada-C11',
    cacheExpiry: '5 minutes',
    allGithubRepos: ['repo_1', 'repo_2'],
  };

  const mainDate = new Date();

  const negatedDate = new Date(mainDate);
  negatedDate.setMinutes(mainDate.getMinutes() + 5); // + will be negated in index.js

  let cacheDate = new Date(mainDate);
  cacheDate.setMinutes(mainDate.getMinutes() - 5);
  cacheDate = cacheDate.valueOf();

  const {makeCli, mocks} = getProgram(config, mainDate, negatedDate);

  await makeCli().parse('check @');

  const ghMock = mocks.libGithub;

  t.true(ghMock.getRepo.calledWith('Ada-C11', 'repo_1'), cacheDate);
  t.true(ghMock.getRepo.calledWith('Ada-C11', 'repo_2'), cacheDate);

  // Analyze target_user's PRs...
  t.true(ghMock.getReviews.calledWith('Ada-C11', 'repo_1', 1, cacheDate));
  t.true(ghMock.getReviews.calledWith('Ada-C11', 'repo_2', 1, cacheDate));

  // ...but not other_user's
  t.false(ghMock.getReviews.calledWith('Ada-C11', 'repo_1', 2));
});

test('should set, get, and delete config options', async t => {
  const {makeCli, mocks} = getProgram();

  await makeCli().parse(['setConfig', 'githubOrg', 'barbaz']);

  await makeCli().parse(['getConfig', 'githubOrg']);
  t.true(mocks.console.log.calledWith('barbaz'));

  await makeCli().parse(['deleteConfig', 'githubOrg']);

  await makeCli().parse(['getConfig', 'githubOrg']);
  t.true(mocks.console.log.calledWith(undefined));
});

test('should error on invalid config keys', async t => {
  const {makeCli, mocks} = getProgram();

  await makeCli().parse(['setConfig', 'badKey', 'barBaz']);
  t.true(mocks.configstoreMock.set.notCalled);
});

test('should set and get array config options', async t => {
  const {makeCli, mocks} = getProgram();

  await makeCli().parse(['setConfig', 'allGithubRepos', 'repo_1', 'repo_2']);
  await makeCli().parse(['getConfig', 'allGithubRepos']);

  t.true(mocks.console.log.calledWith(['repo_1', 'repo_2']));
});

/* CLI options */
test('should warn if config.json org name is outdated', async t => {
  const config = {
    githubOrg: 'Ada-C1', // outdated,
  };

  const {makeCli, mocks} = getProgram(config, null, null);

  await makeCli().parse('check @');

  t.true(
    mocks.console.log.calledWith(
      chalk.red.bold('WARN GitHub org name may be outdated!')
    )
  );
});

test('should respect cache expiry flag over config.json', async t => {
  const config = {
    cacheExpiry: '5 minutes', // flag should override this value
  };

  const mainDate = new Date();

  const negatedDate = new Date(mainDate);
  negatedDate.setMinutes(mainDate.getMinutes() + 10); // + will be negated in index.js

  let cacheDate = new Date(mainDate);
  cacheDate.setMinutes(mainDate.getMinutes() - 10);
  cacheDate = cacheDate.valueOf();

  let wrongDate = new Date(mainDate);
  wrongDate.setMinutes(mainDate.getMinutes() - 5);
  wrongDate = wrongDate.valueOf();

  const {makeCli, mocks} = getProgram(config, mainDate, negatedDate);

  await makeCli().parse('check @ -c "10 minutes"');

  const ghMock = mocks.libGithub;
  t.true(ghMock.getRepo.calledWith('Ada-C11', sinon.match.string, cacheDate));
  t.true(
    ghMock.getReviews.calledWith(
      'Ada-C11',
      sinon.match.string,
      sinon.match.number,
      cacheDate
    )
  );
  t.false(ghMock.getRepo.calledWith('Ada-C11', sinon.match.string, wrongDate));
  t.false(
    ghMock.getReviews.calledWith(
      'Ada-C11',
      sinon.match.string,
      sinon.match.number,
      wrongDate
    )
  );
});

test('should respect authors flag over config.json', async t => {
  const config = {
    githubAuthors: ['target_user'], // flag should override this value
  };

  const mainDate = new Date();

  const negatedDate = new Date(mainDate);
  negatedDate.setMinutes(mainDate.getMinutes() + 5); // + will be negated in index.js

  let cacheDate = new Date(mainDate);
  cacheDate.setMinutes(mainDate.getMinutes() - 5);
  cacheDate = cacheDate.valueOf();

  const {makeCli, mocks} = getProgram(config, mainDate, negatedDate);
  const ghMock = mocks.libGithub;

  await makeCli().parse('check @ --authors @');

  t.true(
    ghMock.getReviews.calledWith('Ada-C11', sinon.match.any, 1, cacheDate)
  );
  t.true(
    ghMock.getReviews.calledWith('Ada-C11', sinon.match.any, 2, cacheDate)
  );
});

test('should respect repos arg over config.json', async t => {
  const config = {
    allGithubRepos: ['repo_1', 'repo_2'], // flag should override this value
  };

  const mainDate = new Date();

  const negatedDate = new Date(mainDate);
  negatedDate.setMinutes(mainDate.getMinutes() + 5); // + will be negated in index.js

  let cacheDate = new Date(mainDate);
  cacheDate.setMinutes(mainDate.getMinutes() - 5);
  cacheDate = cacheDate.valueOf();

  const {makeCli, mocks} = getProgram(config, mainDate, negatedDate);
  const ghMock = mocks.libGithub;

  await makeCli().parse('check repo_1');

  t.true(
    ghMock.getReviews.calledWith(
      'Ada-C11',
      'repo_1',
      sinon.match.number,
      cacheDate
    )
  );
  t.false(
    ghMock.getReviews.calledWith(
      'Ada-C11',
      'repo_2',
      sinon.match.number,
      cacheDate
    )
  );
});

/* PR checking
 *
 * These tests overlap somewhat vs. the others,
 * but are here for added clarity + coverage
 */
test('should check all repos for all students', async t => {
  const {makeCli, mocks} = getProgram();
  const ghMock = mocks.libGithub;

  await makeCli().parse('check @ --authors @');

  t.true(ghMock.getReviews.calledWith('Ada-C11', 'repo_1', 1));
  t.true(ghMock.getReviews.calledWith('Ada-C11', 'repo_1', 2));
  t.true(ghMock.getReviews.calledWith('Ada-C11', 'repo_2', 1));
  t.true(ghMock.getReviews.calledWith('Ada-C11', 'repo_2', 2));
});

test('should check all repos for specific students', async t => {
  const {makeCli, mocks} = getProgram();
  const ghMock = mocks.libGithub;

  await makeCli().parse('check @ --authors target_user');

  t.true(ghMock.getReviews.calledWith('Ada-C11', 'repo_1', 1));
  t.true(ghMock.getReviews.calledWith('Ada-C11', 'repo_2', 1));
  t.false(ghMock.getReviews.calledWith('Ada-C11', sinon.match.string, 2));
});

test('should check specific repos for all students', async t => {
  const {makeCli, mocks} = getProgram();
  const ghMock = mocks.libGithub;

  await makeCli().parse('check repo_1 --authors @');

  t.true(ghMock.getReviews.calledWith('Ada-C11', 'repo_1', 1));
  t.true(ghMock.getReviews.calledWith('Ada-C11', 'repo_1', 2));
  t.false(
    ghMock.getReviews.calledWith('Ada-C11', 'repo_2', sinon.match.number)
  );
});

test('should check specific repos for specific students', async t => {
  const {makeCli, mocks} = getProgram();
  const ghMock = mocks.libGithub;

  await makeCli().parse('check repo_1 --authors target_user');

  t.true(ghMock.getReviews.calledWith('Ada-C11', 'repo_1', 1));
  t.false(ghMock.getReviews.calledWith('Ada-C11', sinon.match.string, 2));
  t.false(
    ghMock.getReviews.calledWith('Ada-C11', 'repo_2', sinon.match.number)
  );
});
