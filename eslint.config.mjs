import { configWithoutCloudSupport } from '@n8n/node-cli/eslint';

export default [
  ...configWithoutCloudSupport,
  { ignores: ['tests/**'] },
  {
    files: ['package.json'],
    // Maintainer contact uses the public organization URL; no email is invented.
    rules: { '@n8n/community-nodes/valid-author': 'off',
      // Overrides patch development tooling only; the published node has no runtime dependencies.
      '@n8n/community-nodes/no-overrides-field': 'off' },
  },
  {
    files: ['nodes/OpenAgentHub/transport.ts'],
    // Pure validation helpers have no execution node; callers wrap their errors.
    rules: { '@n8n/community-nodes/require-node-api-error': 'off' },
  },
];
