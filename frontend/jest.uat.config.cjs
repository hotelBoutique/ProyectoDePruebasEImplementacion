// Pruebas UAT locales: Selenium + API local, separadas de la suite E2E que puede usar QA.
module.exports = {
  displayName: 'uat-local',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/e2e/uat/**/*.uat.test.js'],
  setupFiles: ['<rootDir>/tests/e2e/setup/loadUatEnv.cjs'],
  globalSetup: '<rootDir>/tests/e2e/setup/localUatSetup.cjs',
  transform: {
    '^.+\\.js$': ['@swc/jest', { jsc: { parser: { syntax: 'ecmascript' } } }],
  },
  testTimeout: 90000,
  verbose: true,
};
