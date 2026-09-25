require('reflect-metadata');
const assert = require('node:assert/strict');
const { mock } = require('node:test');
const { Prisma } = require('../src/generated/prisma/client');

// No PrismaClient is instantiated. Unconfigured database operations fail closed.
function prismaMock() {
  const db = {};
  for (const model of ['user', 'plan', 'category', 'content', 'planContent', 'subscription', 'watchHistory', 'rating']) {
    db[model] = {};
    for (const method of ['findUnique', 'findFirst', 'findMany', 'count', 'create', 'update', 'delete', 'upsert']) {
      db[model][method] = mock.fn(() => {
        throw new Error(`Unexpected database operation: ${model}.${method}`);
      });
    }
  }
  db.$transaction = mock.fn(async (operation, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    return operation(db);
  });
  return db;
}

const returns = (fn, value) => fn.mock.mockImplementation(async () => value);
const implementsFn = (fn, implementation) => fn.mock.mockImplementation(implementation);
const args = (fn, index = 0) => fn.mock.calls[index].arguments[0];
const statusError = (status) => (error) => {
  assert.equal(error.getStatus(), status);
  return true;
};
const prismaError = (code) => new Prisma.PrismaClientKnownRequestError('Synthetic test conflict', {
  code, clientVersion: '7.10.0',
});

module.exports = { prismaMock, returns, implementsFn, args, statusError, prismaError };
