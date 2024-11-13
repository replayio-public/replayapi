const baseConfig = require('./jest.config.base');

module.exports = {
  ...baseConfig,
  projects: ['<rootDir>/packages/*'],
  // coverageDirectory: '<rootDir>/coverage/',
  // collectCoverageFrom: ['<rootDir>/packages/*/src/**/*.{ts,tsx,js,jsx}'],
};
