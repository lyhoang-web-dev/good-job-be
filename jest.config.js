/** @type {import('jest').Config} */
// CommonJS config (this repo is "type": "commonjs"). For a TS config file,
// use `jest --config jest.config.ts` with ts-node registered, or migrate the
// package to ESM and `"type": "module"`.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  forceExit: true,
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: [
    'src/modules/kudos/kudos.service.ts',
    'src/modules/rewards/rewards.service.ts',
    'src/modules/auth/auth.service.ts',
    'src/middleware/errorHandler.middleware.ts',
    'src/middleware/auth.middleware.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      lines: 90,
      statements: 90,
      functions: 90,
      branches: 90,
    },
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          types: ['node', 'jest'],
        },
      },
    ],
  },
}
