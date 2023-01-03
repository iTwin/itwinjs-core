# iTwin.js versioning policies

iTwin.js employs versioning policies to facilitate the following objectives:

- Provide a broad set of stable, well-supported APIs.
- Continuously deliver new features, bug fixes, and security updates.
- Evolve APIs over time in response to user feedback.
- Encourage users to keep up to date with the most recent versions.

## API promotion process

Each API exported by a package is marked with a [release tag](./docs/learning/guidelines/release-tags-guidelines.md) indicating its level of stability. A package's "public" API comprises all of its exported APIs that have been marked with the `@public` release tag. All other APIs are considered "non-public". The [package versioning](#package-versioning-policy) and [API deprecation](#api-deprecation-policy) policies apply only the a package's public API.

`@internal` APIs are never intended to be used outside of the iTwin.js library itself. All other APIs are intended to ultimately become `@public` through the following process:

- A highly experimental API may start out tagged as `@alpha`, indicating it is not yet mature enough for users to try out. This stage is usually skipped.
- A new API, or one that has been promoted from `@alpha`, is tagged as `@beta` to invite users to experiment with it and provide feedback. The API may change in response to feedback from one release to the next.
  - Note: extension APIs are tagged as `@preview` instead of `@beta`.
- A `@beta` API that has been sufficiently tested is promoted to `@public` to indicate that it is now subject to [stability guarantees](#package-versioning-policy).
- A `@public` API may be tagged as `@deprecated` indicating that it may later be removed according to the [deprecation policy](#api-deprecation-policy).

Occasionally, a `@beta` or `@alpha` API may be abandoned rather than being promoted. Not all experiments are successful.

In practice, `@beta` and `@public` APIs are typically designed in a way that promotes flexibility in the future - e.g., by accepting their arguments as "options" object types. This reduces the risk of breaking changes and deprecation.

## Package versioning policy

The individual packages that constitute the iTwin.js libraries use [semantic versioning](https://semver.org/) to convey information about how their public APIs change over time.

- Patch releases occur frequently to fix bugs or security issues and have no impact on the public API.
- Minor releases occur less frequently than patch releases. They may introduce new APIs, but never break any existing `@public` APIs.
- Major releases occur only as frequently as necessary. They can include breaking changes to `@public` APIs, but only according to the [deprecation policy](#api-deprecation-policy).

## API deprecation policy

Most `@public` APIs are intended to remain stable indefinitely, but occasionally a breaking change is required to fix a bug, introduce new functionality, or address performance problems. The deprecation policy ensures that such changes are introduced deliberately and predictably to help users plan ahead.

Before an API can be removed it must first be marked as `@deprecated` in version `N` of the package. It must remain stable for the duration of version `N+1`. Finally, in version `N+2` it *may* be removed. This means that, for example, an API deprecated in version 3.1 of a package cannot be removed until version 5.0 at the earliest.
