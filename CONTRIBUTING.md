# Contributing

Release maintainers should follow the [release guide](RELEASING.md).

Open an issue before substantial changes so package compatibility and the public-release boundary
can be agreed first. Pull requests must keep the React, Next.js, and CLI packages at one shared version, with
`publishConfig.tag` matching that version's channel (`latest` for a release, `beta` for a
prerelease), and pass:

```sh
npm test
npm run check:secrets
npm run verify:npm-packages
```

Only reviewed commits contained in `main` may receive an immutable `npm-v<version>` release tag.
Never add npm tokens, `.npmrc`, environment files, private keys, private product source, or files
that are not recorded in `public-release-manifest.json`.
