`use strict`;

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('ava');

const getProgram = (
  cacheExists,
  cacheDate,
  cacheData,
  httpResponse,
  configValues
) => {
  // Default values
  cacheExists = cacheExists || false;
  cacheDate = cacheDate || new Date();
  httpResponse = httpResponse || {data: '', status: 204};
  configValues = configValues || {};
  cacheData = cacheData || '{}';

  const fsMock = {
    existsSync: sinon.stub().returns(cacheExists),
    statSync: sinon.stub().returns({mtime: cacheDate}),
    mkdirSync: sinon.stub(),
    writeFileSync: sinon.stub(),
    readFileSync: sinon.stub().returns(cacheData),
  };

  const axiosMock = {
    get: sinon.stub(),
  };
  if (httpResponse.status.toString().startsWith('20')) {
    axiosMock.get.resolves(httpResponse);
  } else {
    axiosMock.get.rejects({response: httpResponse});
  }

  const configMock = Object.assign(
    {
      githubUsers: ['user_1', 'user_2'],
      githubOrg: 'Ada-C11',
      cacheExpiry: '60 minutes',
      allGithubRepos: ['repo_1', 'repo_2'],
      githubAuthToken: '1234abcd',
    },
    configValues
  );

  const configstoreMock = {
    get: sinon.stub().callsFake(x => configMock[x]),
    set: sinon.stub().callsFake((x, y) => {
      configMock[x] = y;
    }),
  };

  const mocks = {
    fs: fsMock,
    axios: axiosMock,
    configstore: sinon.stub().returns(configstoreMock),
    config: configMock,
  };

  return {
    program: proxyquire('../lib/github', mocks),
    mocks,
  };
};

/* Setup */
test('should auto-create cache directory if necessary', t => {
  const {program, mocks} = getProgram(false);

  program.getRepo('Ada-C1', 'repo', new Date());

  t.true(mocks.fs.mkdirSync.calledOnce);
});

test('should not re-create existing cache directory', t => {
  const {program, mocks} = getProgram(true);

  program.getRepo('Ada-C1', 'repo', new Date());

  t.true(mocks.fs.mkdirSync.notCalled);
});

/* Auth tokens */
test('should validate provided GitHub tokens', async t => {
  const {program} = getProgram(true, null, null, null, {
    githubAuthToken: '!bad!',
  });

  await t.throwsAsync(async () => {
    await program.getRepo('Ada-C1', 'repo', new Date());
  }, /Invalid GitHub auth token/);
});

test('should prompt for token if rate-limited', async t => {
  const {program} = getProgram(true, null, null, {
    data: '',
    status: 403,
  });

  await t.throwsAsync(async () => {
    await program.getRepo('Ada-C1', 'repo', new Date());
  }, /rate-limited/);
});

/* Input validation */
test('should validate org name', async t => {
  const {program} = getProgram();

  await t.throwsAsync(async () => {
    await program.getRepo('org', 'repo', new Date());
  }, /Invalid GitHub org name/);
});

test('should validate repo name', async t => {
  const {program} = getProgram();

  await t.throwsAsync(async () => {
    await program.getRepo('Ada-C1', '! bad !', new Date());
  }, /Invalid GitHub repo name/);
});

test('should validate pull ID', async t => {
  const {program} = getProgram();

  await t.throwsAsync(async () => {
    await program.getReviews('Ada-C1', 'repo', 'badID', new Date());
  }, /Invalid GitHub pull ID/);
});

/* getRepo */
test('should get + cache repo from github', async t => {
  const {program, mocks} = getProgram(false);

  await program.getRepo('Ada-C1', 'repo', new Date());

  t.true(mocks.fs.existsSync.calledTwice); // twice: cache dir + cached file
  t.true(mocks.axios.get.calledOnce);
  t.true(mocks.fs.writeFileSync.calledOnce);
});

test('should get repo from cache', async t => {
  const date = new Date();
  date.setDate(date.getDate() + 1); // tomorrow
  const {program, mocks} = getProgram(true, date);

  await program.getRepo('Ada-C1', 'repo', new Date());

  t.true(mocks.fs.existsSync.calledTwice); // twice: cache dir + cached file
  t.true(mocks.axios.get.notCalled);
  t.true(mocks.fs.writeFileSync.notCalled);
});

test('should get repo from github if cache is old', async t => {
  const date = new Date();
  date.setDate(date.getDate() - 1); // yesterday
  const {program, mocks} = getProgram(true, date);

  await program.getRepo('Ada-C1', 'repo', new Date());

  t.true(mocks.fs.existsSync.calledTwice); // twice: cache dir + cached file
  t.true(mocks.fs.statSync.calledOnce);
  t.true(mocks.axios.get.calledOnce);
  t.true(mocks.fs.writeFileSync.calledOnce);
});

/* getReviews */
test('should get + cache reviews from github', async t => {
  const {program, mocks} = getProgram(false);

  await program.getReviews('Ada-C1', 'repo', 1, new Date());

  t.true(mocks.fs.existsSync.calledTwice); // twice: cache dir + cached file
  t.true(mocks.axios.get.calledOnce);
  t.true(mocks.fs.writeFileSync.calledOnce);
});

test('should get reviews from cache', async t => {
  const date = new Date();
  date.setDate(date.getDate() + 1); // tomorrow
  const {program, mocks} = getProgram(true, date);

  await program.getReviews('Ada-C1', 'repo', 1, new Date());

  t.true(mocks.fs.existsSync.calledTwice); // twice: cache dir + cached file
  t.true(mocks.axios.get.notCalled);
  t.true(mocks.fs.writeFileSync.notCalled);
});

test('should get reviews from github if cache is old', async t => {
  const date = new Date();
  date.setDate(date.getDate() - 1); // yesterday
  const {program, mocks} = getProgram(true, date);

  await program.getReviews('Ada-C1', 'repo', 1, new Date());

  t.true(mocks.fs.existsSync.calledTwice); // twice: cache dir + cached file
  t.true(mocks.fs.statSync.calledOnce);
  t.true(mocks.axios.get.calledOnce);
  t.true(mocks.fs.writeFileSync.calledOnce);
});
