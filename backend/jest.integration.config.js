module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/src/integration-tests/**/*.integration.test.js'],
    setupFiles: ['<rootDir>/src/integration-tests/setupEnv.js'],
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 30000,
    maxWorkers: 1
};
