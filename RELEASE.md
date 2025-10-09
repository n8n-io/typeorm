# Release

Temporary release process until we bring this fork into the `n8n-io/n8n` monorepo.

1. Merge PR to bump version in `package.json` (update suffix only)
2. Install dev dependency: `npm install --save-dev @sentry/node` (required to compile in next step)
3. Create dist: `npm run package`
4. Test publish: `cd ./build/package && npm publish --access public --dry-run` (requires publish permission)
5. Publish: `npm publish --access public`
6. Verify on npm: https://www.npmjs.com/package/@n8n/typeorm?activeTab=versions