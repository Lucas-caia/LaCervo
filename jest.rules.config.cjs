module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  testTimeout: 30000,
  maxWorkers: 1
};
