# Release Tags

Release tags are used to classify API items according to their intended level of support.
Release tags are included in standard documentation comments and are processed by tools such as [api-extractor](https://api-extractor.com/) to produce an API review file.
API review files can then be placed under source code control and compared to future SDK versions to ensure that the API is evolving in compatible or expected ways.

## Supported Release Tags

The supported release tags are:

* `@public`
* `@beta`
* `@alpha`
* `@internal` / `@hidden`
* `@deprecated`

Details about each tag are below.

### @public

The `@public` release tag indicates that an API item has been officially released.
This means that the API item is part of the *supported contract* and affects the semantic version of the package.
*Public* API items must be supported through the entire major release lifetime and can only evolve in compatible ways (for example, an additional default argument to a function) during the current major release.

### @beta

The `@beta` release tag indicates that an API item has been released in an experimental state.
Third parties are encouraged to try it and provide feedback.
However, *beta* API items should **NOT** be used in production as they still may change going forward.
*Beta* API items are not part of the *supported contract* and changes to these API items do not follow the normal semantic versioning rules.
*Beta* API items are included in the public SDK documentation.

### @alpha

The `@alpha` release tag indicates that an API item is eventually intended to be public, but currently is in an early stage of development.
Third parties should not use *alpha* APIs in production or otherwise as they are likely to change going forward.
*Alpha* API items are not part of the *supported contract* and changes to these API items do not follow the normal semantic versioning rules.
*Alpha* API items are intentionally hidden from the public SDK documentation.

### @internal / @hidden

> Note: The iModel.js tooling is transitioning from the former `@hidden` tag to the new/intended `@internal` release tag.
The `@hidden` tag should still be used with the understanding that all occurrences will be renamed at some point in the near future.

The `@internal` release tag indicates that an API item is meant only for usage by other NPM packages from the same maintainer.
Third parties should never use *internal* APIs.
*Internal* API items are intentionally hidden from the public SDK documentation.
However, *internal* API items are effectively *public* from the maintainers perspective, so should follow the same evolution rules as *public* API items if at all possible.

> Note: This definition of `@internal` requires us to set the `--stripInternal` [option of the TypeScript compiler](http://www.typescriptlang.org/docs/handbook/compiler-options.html) to `false`.

### @deprecated

The `@deprecated` release tags is used for API items that were formerly `@public` but are no longer optimal.
Third parties should avoid *deprecated* API items if possible as they will likely be removed in the next major release.
From the maintainer's perspective, *deprecated* API items follow the same rules as *public* API items within the current major release.
*Deprecated* API items are included in the public SDK documentation.

### Release Tag Summary

The following table summarizes the affects of each release tag:

Release Tag | Affects Package Semantic Version | Included in Public SDK Documentation
------------|----------------------------------|-------------------------------------
`@public` | Yes | Yes
`@beta` | No | Yes
`@alpha` | No | No
`@internal` / `@hidden` | Yes | No
`@deprecated` | Yes | Yes

## API Items

An API Item is an **exported** TypeScript item that includes:

* Classes
* Class Members
* Namespaces
* Namespace Members
* Interfaces
* Types
* Enums
* Enum Members

Here are the guidelines for when a release tag is needed:

Exported API Item | Release Tag Guidelines
------------------|-----------------------
Class | Always. The presence of a release tag indicates some thought was given while the absence of a release tag is ambiguous.
Class Member | Only if different than the containing class. |
Namespace | Always.
Namespace Member | Only if different than the containing namespace.
Interface | Always.
Type | Always.
Enum | Always.
Enum Member | Only if different than the containing enum.

> Note: Non-exported TypeScript items should not have release tags.

## Style Guidelines

The release tag should be on its own line:

```ts
/** Sample description of an exported API item.
 * @public
 */
```

*Internal* API items should include documentation that indicates why it is not *public* and what third parties should use instead.

```ts
/** Explanation of why the API item is marked internal.
 * @see Other public API item that third parties should use instead.
 * @internal
 */
```

Likewise, *deprecated* API items should include documentation that indicates what third parties should use instead.

```ts
/** Explanation of why the API item has been marked deprecated.
 * @see Other public API item that third parties should use instead.
 * @deprecated
 */
```

*Beta* and *alpha* API items should include a short reason for that classification.

```ts
/** Sample description of an exported API item.
 * @beta Waiting for feedback from...
 */
```

```ts
 /** @alpha Prototype code. Not sure if this is the right approach or not. */
```
