# Semantic Versioning

Semantic Versioning is a public API versioning scheme that uses a 3 part `MAJOR.MINOR.PATCH` version number.
Under this scheme, version numbers and the way that they change convey meaning about the public API and how it has changed from one version to another.
Bentley uses semantic versioning for all npm packages.

Please see [semver.org](https://semver.org/) for the full Semantic Versioning specification.

-----------------------------------------

## Responsibilities of a Package Producer

A package producer must understand that a customer (a package consumer) will be on a different schedule than that of the package itself.
This means that there must be multiple released versions of the package and that the semantic versioning rules must be followed to properly partition the public API changes.

Given a `MAJOR.MINOR.PATCH` version number, a package producer must increment the:

- `MAJOR` version when the public API has changed in an incompatible way.
- `MINOR` version when the public API has changed in a backwards-compatible way
- `PATCH` version when you make backwards-compatible bug fixes

### When to increment the MAJOR version

Examples of incompatible changes that require incrementing the `MAJOR` version include:
- Renaming a class or method
- Removing a class or method
- Changing the signature of a method
- Changing the structure of a JSON message
- Significant change in API behavior

Note that incrementing the `MAJOR` version should reset the `MINOR` and `PATCH` versions to `0`.

### When to increment the MINOR version

Examples of backwards-compatible changes that require incrementing the `MINOR` version include:
- Adding a new class
- Adding a new method
- Adding a new optional parameter to a method

Note that incrementing the `MINOR` version should reset the `PATCH` version to `0`.

### When to increment the PATCH version

Examples of backwards-compatible changes that require incrementing the `PATCH` version include:
- Making a bug fix
- Updating documentation
- Adding a static resource to the published package

-----------------------------------------

## Responsibilities of a Package Consumer

A package consumer must understand that a package needs to evolve over time.
A package consumer must also have a plan for moving forward to later released versions to reduce the overall support burden and need to maintain legacy versions.

There are different strategies for a package consumer to express its dependency on a package.
These dependencies are maintained in the `package.json` of the consumer.

| Dependency Type       | Example                        | Meaning |
|-----------------------|--------------------------------|---------|
| MINOR and PATCH range | "example-dependency": "^1.2.3" | Accept version 1.2.3 or greater with a matching `MAJOR` version. | 
| PATCH range           | "example-dependency": "~1.2.3" | Accept version 1.2.3 or greater with matching `MAJOR` and `MINOR` versions. | 
| Exact                 | "example-dependency": "1.2.3"  | Accept only version 1.2.3 |
