module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/src/**/*.test.js'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/src/integration-tests/'
    ],
    clearMocks: true,
    restoreMocks: true
};
