module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/**/*.test.[jt]s?(x)'],
  setupFiles: ['<rootDir>/src/test/polyfills.cjs'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  moduleNameMapper: {
    '(^|/)runtimeConfig$': '<rootDir>/src/test/runtimeConfig.ts',
    '\\.(css)$': '<rootDir>/src/test/styles.cjs'
  },
  clearMocks: true,
  maxWorkers: 2,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/test/**', '!src/main.tsx'],
  coverageDirectory: 'coverage'
};
