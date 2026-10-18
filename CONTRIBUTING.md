# Contributing

Report the Foundry, PF2e and module versions, weapon type, relevant settings, other ammunition modules, and a minimal synthetic reproduction. Do not attach campaign exports, player information or credentials.

Run `npm test`, `npm run build`, and `npm run check:release`. These public checks use Node24/Python3.10+ and require no Foundry license. Native gameplay tests must use an isolated licensed instance; see [testing](docs/testing.md).

Preserve ammunition quantities/uses, exact preferred-ammo identity, ownership checks, fired-ammunition damage and native behavior when disabled. Keep compatibility changes supported by actual tests. Development used AI assistance; maintainers and contributors remain responsible for understanding and maintaining their changes.
