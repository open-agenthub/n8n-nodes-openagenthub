# Release to npm

The repository is prepared for npm publishing; creating or pushing commits does not publish it. A stable GitHub Release triggers `.github/workflows/publish.yml`. The tag must be `v` followed by the exact `package.json` version.

## One-time npm setup

1. Confirm that you control `n8n-nodes-openagenthub` on npm and that the package name is available. If this is the first publication, run `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`, and `npm run build`, inspect `npm pack --dry-run --ignore-scripts`, then publish the first version interactively with a maintainer npm account and 2FA: `npm publish --access public`. This initial publication is a deliberate maintainer action; it is not performed by setup or CI.
2. In the npm package settings, add a GitHub Actions trusted publisher: organization `open-agenthub`, repository `n8n-nodes-openagenthub`, workflow filename `publish.yml`, environment `npm`. Permit the `npm publish` action. Do not create an npm access token for this workflow.
3. The GitHub environment `npm` is already created and restricted to `v*` tags. Configure required reviewers according to the organization's release policy. Protect `main` and require CI before merge.
4. Private vulnerability reporting is already enabled in repository settings.

## Subsequent releases

Update the package version and lockfile in a reviewed PR, merge passing CI, create a matching tag on the reviewed commit, and publish a stable GitHub Release. The workflow checks the tag version, installs the lockfile without dependency lifecycle scripts, type-checks, tests, builds, audits production dependencies, then publishes with OIDC and provenance. Draft releases and prereleases do not publish. Do not publish another GitHub Release for the already bootstrapped version.

OIDC requires npm 11.5.1 or newer and Node 22.14 or newer; CI uses Node 24. npm package settings must match the workflow identity exactly. npm permissions and first publication cannot be configured solely by files in a GitHub repository.

References: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), [npm provenance](https://docs.npmjs.com/generating-provenance-statements/), [n8n node CLI](https://github.com/n8n-io/n8n/tree/master/packages/%40n8n/node-cli).
