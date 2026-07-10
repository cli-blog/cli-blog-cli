# CLI maintainer checklist

This package does not deploy to Coolify. Its Stage 2 gate is package verification in GitHub Actions.

## Protected branches

Protect both `staging` and `main` with:

- required pull requests;
- required status check `CI / test`;
- no force pushes;
- no branch deletion.

## CI gate

The `CI` workflow runs on pull requests and pushes to `staging` and `main`:

1. `bun run prepublishOnly`
2. `bun run pack:dry`

Do not publish from Stage 2. Package publication remains release-controlled through the `Publish` workflow and npm provenance.
