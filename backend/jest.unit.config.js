module.exports = {
    testEnvironment: 'node',
    testMatch: [
        '<rootDir>/src/unit-tests/**/*.test.js',
        '<rootDir>/src/services/**/*.test.js',
        '<rootDir>/src/utils/**/*.test.js'
    ],
    clearMocks: true,
    restoreMocks: true
};
