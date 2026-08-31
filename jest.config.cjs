/**
 * Concurrent worker ceiling for this suite, and the fallback for a bare `pnpm test` run
 * made outside moon. The number itself and the reasoning behind it live in
 * `.moon/tasks/node.yml`, which is the single place the container's
 * concurrency-by-workers-by-heap ratio is decided and which exports
 * `TEST_MAX_WORKERS` on the shared `test` task. The literal mirrors that export so a
 * direct run is capped too, instead of falling back to jest's default of one worker per
 * core less one against a container that has six.
 */
const maxWorkers = Number(process.env.TEST_MAX_WORKERS) || 4;

/** @type {import('jest').Config} */
const config = {
  maxWorkers,
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json']
};

module.exports = config;
