// Configuración de Jest para las pruebas E2E con Selenium WebDriver.
// Separada de jest.config.cjs (unitarias con jsdom) porque estas pruebas
// abren un navegador real y necesitan el frontend y la API de QA en ejecución.
module.exports = {
  displayName: 'e2e',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/e2e/**/*.e2e.test.js'],
  setupFiles: ['<rootDir>/tests/e2e/setup/loadEnv.cjs'],
  globalSetup: '<rootDir>/tests/e2e/setup/globalSetup.cjs',
  transform: {
    '^.+\\.js$': ['@swc/jest', { jsc: { parser: { syntax: 'ecmascript' } } }],
  },
  // Render puede tardar cerca de un minuto en despertar la API de QA.
  testTimeout: 90000,
  verbose: true,
};
