# Release Tags

Release tags are used to classify API items according to their intended level of support.
Release tags are included in standard documentation comments and are processed by tools such as [api-extractor](https://api-extractor.com/) to produce an API review file.
API review files can then be placed under source code control and compared to future SDK versions to ensure that the API is evolving in compatible or expected ways.

## Supported Release Tags

The four primary release tags and the "deprecated" tag are described in the [API support policies](../api-support-policies.md). For [Extensions](../frontend/Extensions.md), two additional tags are supported:

- The "extensions" tag indicates that an API is to be included in the `@itwin/core-extension` API. Currently this tag is only useful for APIs in `@itwin/core-frontend` and `@itwin/core-common`; all other packages' APIs can be used directly by extensions. It may become relevant for more packages in the future. A lint rule enforces that the "extensions" tag may only be applied to APIs tagged as "public".

## API Items

Every API exported by a package must have a release tag.
Members of classes, interface, namespace, and enums inherit the release tag applied to their containing type unless explicitly overridden.
The release tag applied to such a member can only be more restrictive than that applied to its container. For example, a "beta" class can contain "alpha" or "internal" properties, but not "public" ones.

## Reviewing release tags

When reviewing a PR that adds, removes, or changes APIs, consider the following:

- Do the changes contradict our [package versioning policy](../api-support-policies.md#package-versioning-policy)? For example, by making breaking changes to a "public" API?
- Do the changes contradict our [API deprecation policy](../api-support-policies.md#api-deprecation-policy)? For example, by removing a public API that was not previously deprecated?
- Do the release tags applied to newly-introduced APIs make sense? For example, should an "alpha" API be marked "beta" to solicit early feedback to inform its development?
- Do "public" and "beta" APIs have sufficient documentation?

## Style Guidelines

The release tag should be on its own line - preferably the last line in the documentation comment:

```ts
/** Sample description of an exported API item.
 * @public
 */
```

*Internal* API items should include documentation that indicates why it is not *public* and what users should use instead.

```ts
/** Private explanation of why the API item is marked internal as a reminder to the maintainer or notice to someone perusing the source code.
 * @see Other public API item that users should use instead.
 * @internal Comments can also go here.
 */
```

Likewise, a *deprecated* API item should include documentation about when it became deprecated and what users should use instead.
Use the format `@deprecated in <Major.Minor>. <What API to use instead>.`
If relevant and helpful, you can also include a description of why the API became deprecated, e.g., poor performance.

```ts
/** Original documentation comment is typically maintained here.
 * @see Other public API item that third parties should use instead.
 * @public
 * @deprecated in 4.2. Comment describing reason API item is deprecated and what should be used instead.
 */
```

*Extensions* API tag should be on its own line after the supported release tag:

```ts
/** Sample description of an exported API item.
 * @public
 * @extensions
 */
```
