# Pinned source provenance

The project vendors ordinary source files, not embedded Git repositories. Foundry may warn that it cannot discover a Git revision for these directories; the exact archive revisions are pinned here and in `foundry.lock`. Reproducing a build does not require a dependency update.

| Source | Exact revision | Used files | License |
| --- | --- | --- | --- |
| api3dao/airnodehub-hackathon-starter | `52933ae1fb9371446a927338473466c3d320e19a` | `contracts/vendor/{AirnodeV2Attestation,ProjectedJson,IsoTimestamp}.sol` copied unmodified | MIT, adjacent `API3-LICENSE` |
| OpenZeppelin/openzeppelin-contracts | `cab19933c33c2ad1d4c7a84864a3601dddfd16f3`, v5.7.0 | `lib/openzeppelin-contracts/contracts` | MIT, adjacent `LICENSE` |
| vectorized/solady | `acd959aa4bd04720d640bf4e6a5c71037510cc4b`, v0.1.26 | `lib/solady/src` | MIT, adjacent `LICENSE` |
| foundry-rs/forge-std | `f3dae6e6ee381f25eb6a246f7da9b85c91a68219`, v1.17.0 | `lib/forge-std/src` | MIT/Apache-2.0, adjacent license files |

Libraries follow the versions in the official starter's Foundry lockfile. Archives were fetched from GitHub's codeload endpoint at those immutable revisions. Non-source examples, upstream test suites and build assets were omitted from the vendored dependency directories. `contracts/vendor/` contains the three full official helper files, including their original attribution comments.

Compiler: Solidity 0.8.37, Cancun target, optimizer 200 runs, IR pipeline. `forge test` compiles the project; `forge build --sizes` reports deployable bytecode limits. These libraries do not make the whole application audited.
