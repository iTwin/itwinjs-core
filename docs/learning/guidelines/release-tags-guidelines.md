# Release Tags

Release tags are used to classify API items according to their intended level of support.
Release tags are included in standard documentation comments and are processed by tools such as [api-extractor](https://api-extractor.com/) to produce an API review file.
API review files can then be placed under source code control and compared to future SDK versions to ensure that the API is evolving in compatible or expected ways.

## Supported Release Tags

The supported release tags are:

- `@public`
- `@beta`
- `@alpha`
- `@internal`
- `@deprecated`

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
*Beta* API items and the comment after the `@beta` tag are included in the public SDK documentation.

### @alpha

The `@alpha` release tag indicates that an API item is eventually intended to be public, but currently is in an early stage of development.
Third parties should not use *alpha* APIs in production or otherwise as they are likely to change going forward.
*Alpha* API items are not part of the *supported contract* and changes to these API items do not follow the normal semantic versioning rules.
*Alpha* API items are intentionally hidden from the public SDK documentation.

### @internal

The `@internal` release tag indicates that an API item is **never** meant to be *public* and is meant only for usage by other NPM packages from the same maintainer.
Third parties should never use *internal* APIs.
*Internal* API items are intentionally hidden from the public SDK documentation.
However, *internal* API items are effectively *public* from the maintainers perspective, so should follow the same evolution rules as *public* API items if at all possible.

> Note: This definition of `@internal` requires us to set the `--stripInternal` [option of the TypeScript compiler](http://www.typescriptlang.org/docs/handbook/compiler-options.html) to `false`.

### @deprecated

The `@deprecated` release tags is used for API items that were formerly `@public` but are no longer optimal.
Third parties should avoid *deprecated* API items if possible as they will likely be removed in the next major release.
From the maintainer perspective, *deprecated* API items follow the same rules as *public* API items within the current major release.
*Deprecated* API items and the comment after the `@deprecated` tag are included in the public SDK documentation.

> Note: The deprecation message is used verbatim by the `deprecation` lint rule and is also included in the SDK documentation.
The deprecation message should include the replacement API item linked using the `[[replacement]]` (double square bracket) link syntax so that the SDK documentation will have a hyperlink and the lint message will mention the replacement item in a readable form.
More advanced linking syntax should not be used as it would distract in the lint rule case.

### Release Tag Summary

The following table summarizes the affects of each release tag:

Release Tag | Affects Package Semantic Version | Included in Public SDK Documentation
------------|----------------------------------|-------------------------------------
`@public` | Yes | Yes
`@beta` | No | Yes
`@alpha` | No | No
`@internal` | Yes | No
`@deprecated` | Yes | Yes

## API Items

An API Item is an **exported** TypeScript item that includes:

- Classes
- Class Members
- Namespaces
- Namespace Members
- Interfaces
- Types
- Enums
- Enum Members

Here are the guidelines for when a release tag is needed:

> Note: Non-exported TypeScript items should not have release tags.

Exported API Item | Release Tag Guidelines
------------------|-----------------------
Class | Always. The presence of a release tag indicates some thought was given while the absence of a release tag is ambiguous.
Class Member | Only if different than the containing class.
Namespace | Always.
Namespace Member | Only if different than the containing namespace.
Interface | Always.
Type | Always.
Enum | Always.
Enum Member | Only if different than the containing enum.

> Note: Members cannot *expand* the scope of their container.
For example, it is invalid to have a `@public` member within an `@alpha` or `@beta` container.
It is also invalid to have a `@public` member within a `@deprecated` container.

## Release Tag Progression for API Items

### Initial Development Workflow

It is typical for a new API item to start with the `@alpha` release tag.
This indicates that the API item is in prototype form and is not ready for public feedback.
*Alpha* API items are hidden from the public SDK documentation since public feedback is not desired.
However, private/targeted feedback can be obtained since *alpha* API items are actually included in the published package.

Once the developer has more confidence in the API item, it can be marked with the `@beta` release tag.
This indicates that public feedback is desired, but that changes may happen based on that feedback.

Once the API item has been proven in the desired scenarios and the developer is willing to maintain compatibility long term (an absolute minimum of the current major release), the API item can be marked with `@public`.

> Note: It is not recommended for API items to go straight to `@public` without public feedback. Even if the implementation is straightforward and meets all requirements, there is always the possibility that the wrong name was chosen.
However, skipping the `@alpha` step is common when the level of uncertainty is low.

### Deprecation Workflow

Sometimes a better way of doing something is discovered after the initial approach was made public.
This is when the deprecation workflow is applicable.
In this case, the existing `@public` API item is marked `@deprecated` with documentation that specifies the new approach.
The *deprecated* API item must be maintained for the current major release and can only be considered for removal in the next major release.

## Style Guidelines

The release tag should be on its own line:

```ts
/** Sample description of an exported API item.
 * @public
 */
```

*Internal* API items should include documentation that indicates why it is not *public* and what third parties should use instead.

```ts
/** Private explanation of why the API item is marked internal as a reminder to the maintainer or notice to someone perusing the source code.
 * @see Other public API item that third parties should use instead.
 * @internal Comments can also go here.
 */
```

Likewise, *deprecated* API items should include documentation that indicates what third parties should use instead.

```ts
/** Original documentation comment is typically maintained here.
 * @see Other public API item that third parties should use instead.
 * @deprecated Comment describing reason API item is deprecated and what should be done instead.
 */
```

*Beta* and *alpha* API items should include a short reason for that classification.

```ts
/** Sample description of a beta API item.
 * @beta Comment describing reason API item is beta that will be included in the public SDK documentation.
 */
```

```ts
 /** @alpha Private comment reminding maintainer why API item was marked alpha. */
```
