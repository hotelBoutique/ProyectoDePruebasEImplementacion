module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.js'],
  testMatch: ['<rootDir>/tests/unit/**/*.test.jsx'],
  transform: {
    '^.+\\.[jt]sx?$': ['@swc/jest', {
      jsc: {
        parser: { syntax: 'ecmascript', jsx: true },
        transform: { react: { runtime: 'automatic' } },
      },
    }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/unit/styleMock.js',
  },
  clearMocks: true,
};
