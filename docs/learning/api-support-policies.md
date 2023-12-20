# iTwin.js API support policies

iTwin.js employs support policies to facilitate the following objectives:

- Provide a broad set of stable, well-supported APIs.
- Continuously deliver new features, bug fixes, and security updates.
- Evolve APIs over time in response to user feedback.
- Encourage users to keep up to date with the most recent package versions.

Sometimes, APIs evolve in a way that requires making backwards-incompatible changes to them, or removing them altogether. The support policies below detail under what circumstances such breaking changes can occur and how iTwin.js endeavors to minimize their impact on consumers of the library.

## Breaking changes

A "breaking change" is any change to an existing API that causes a compilation error in code that uses that API; or causes new undesirable run-time behavior in previously-compiled code that uses that API.

TypeScript's type system and the JavaScript environment in which it executes both provide lots of flexibility. As an unfortunate side effect, that flexibility [significantly broadens](https://www.semver-ts.org/) the scope of what changes can be considered "breaking". For the purposes of this support policy, the following are considered breaking changes:

- Interfaces
  - Removing a property.
  - Adding a new required property.
  - Changing the type of a property.
  - Adding a new optional property with a name that is likely to conflict with existing usage of the interface.
- Classes (excluding `private` properties and methods)
  - Removing a property or method.
  - Adding a new required abstract property or method.
  - Adding a new property or method with a name that is likely to conflict with existing subclasses.
  - Changing the visibility of a property or method.
  - Changing the type of a property.
- Functions and methods
  - Changing the signature (parameters and/or return type).
    - Exception: appending new arguments with default values.
    - Exception: changing the return type from `void` to something else.
- Enums and tagged unions
  - Removing values from an enum or types from a union.
  - Adding new values to an enum or types to a tagged union, unless it is unlikely that existing code tests exhaustively for all possible values.

The iTwin.js team strives to avoid breaking changes whenever possible. We also endeavor to design our APIs with flexibility to evolve without the need for breaking changes - for example, by defining functions to receive their parameters as a single object type instead of multiple individual arguments.

## API categories

iTwin.js uses [API Extractor](https://api-extractor.com/) to help manage its APIs. Each API exported by a package is marked with one of four ["release tags"](https://api-extractor.com/pages/tsdoc/doc_comment_syntax/) categorizing its level of maturity.

- ["internal"](https://api-extractor.com/pages/tsdoc/tag_internal/) indicates an API that is intended strictly to be used inside the iTwin.js libraries - never by users.
- ["alpha"](https://api-extractor.com/pages/tsdoc/tag_alpha/) indicates a highly-experimental API that is not yet ready for testing by users. These are rare in iTwin.js as we are typically interested in early feedback.
- ["beta"](https://api-extractor.com/pages/tsdoc/tag_beta/) indicates an API currently under development. Users are encouraged to experiment with the API and provide feedback, but should not use it in production.
- ["public"](https://api-extractor.com/pages/tsdoc/tag_public/) indicates a stable API suitable for use in production.

In addition to any one of the above release tags, an API may also be tagged as ["deprecated"](https://api-extractor.com/pages/tsdoc/tag_deprecated/), indicating that it should no longer be used and may be removed in a future release. A deprecated tag is typically accompanied by information about the package version in which it became deprecated and guidance for adjusting existing usage of the API, e.g., what API to use instead. A "public" deprecated API will only be removed according to the [deprecation policy](#api-deprecation-policy).

Only "public" and "beta" APIs are included in the [published documentation](https://www.itwinjs.org/reference/). An API typically starts out as "beta". It may evolve rapidly in response to feedback before stabilizing and being promoted to "public". On occasion, a "beta" API may be abandoned - not all experiments succeed.

The "public API" of a package comprises the set of all APIs it contains that are marked with the "public" release tag. The package's public API enjoys stability guarantees provided by the [package versioning policy](#package-versioning-policy).

## Package versioning policy

The individual packages that constitute the iTwin.js libraries use [semantic versioning](https://semver.org/) ("semver") to convey information about how their public APIs change over time.

- Patch releases occur frequently to fix bugs or security issues and have no impact on the public API.
- Minor releases occur less frequently than patch releases. They may introduce new APIs, but never break any existing public APIs.
- Major releases occur only as frequently as necessary. They can include breaking changes to public APIs, but only according to the [deprecation policy](#api-deprecation-policy).

Rare exceptions may be made to this policy when a breaking API change is required to fix a bug and the severity of the bug significantly outweighs the impact of the API change on existing code.

## API deprecation policy

Most public APIs are intended to remain stable indefinitely, but occasionally a breaking change is required to fix a bug, introduce new functionality, or address performance problems. The deprecation policy ensures that such changes are introduced deliberately and predictably to help users plan ahead.

Before a "public" API can be removed it must first be marked as "deprecated" in version `N` of the package. It must remain stable for the duration of version `N+1`. Finally, in version `N+2` it _may_ be removed. This means that, for example, an API deprecated in version 4.1 of a package cannot be removed until version 6.0 at the earliest.

## Package support policy

Each major release of an iTwin.js package undergoes a support lifecycle consisting of the following consecutive phases:

- The "current" version is the most recent major release. It receives regular updates containing new features, bug fixes, and security patches.
- Immediately after a new major release, the previous "current" version becomes an "active" version. It receives updates containing bug fixes and security patches.
- After six months, an "active" version transitions to "maintenance", during which it receives **critical** bug fixes and security patches.
- A further six months later, a "maintenance" version reaches "end of life", after which it receives no further updates.

Very rarely, a critical security issue may arise that cannot reasonably be addressed in an "active" or "maintenance" version without violating the above lifecycle. In such a case, we may need to make a non-semver-compliant change or end support early for that specific major version. Notice will be provided if such a decision is made.

## Version support status

| Major Version | Status          | Release    | Active Start | Maintenance Start | End-of-life        |
| ------------- | --------------- | ---------- | ------------ | ----------------- | ------------------ |
| 1.x           | **End of life** | 2019-06-03 | 2020-05-07   | n/a               | 2020-11-01         |
| 2.x           | **End of life** | 2020-05-07 | 2022-01-24   | 2022-12-31        | 2023-3-31          |
| 3.x           | **Maintenance** | 2022-01-24 | 2023-05-22   | 2023-11-22        | **_2024-05-22_\*** |
| 4.x           | **Current**     | 2023-05-22 | TBD          | TBD               | TBD                |

_\*Dates are subject to change._

## Supported Platforms

Each major version of iTwin.js supports a different set of platform versions, please refer to [Supported Platforms](./SupportedPlatforms.md).
