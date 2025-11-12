---
publish: false
---

# NextVersion

- [NextVersion](#nextversion)
  - [Node.js 24 support](#nodejs-24-support)
  - [Presentation changes](#presentation-changes)
  - [API deprecations](#api-deprecations)
    - [@itwin/presentation-common](#itwinpresentation-common)

## Node.js 24 support

In addition to [already supported Node.js versions](../learning/SupportedPlatforms.md#supported-nodejs-versions), iTwin.js now supports [Node.js 24](https://nodejs.org/en/blog/release/v24.11.0).

## Presentation changes

- Changed content traversal to have internal state, improving performance when traversing large contents. See [API deprecations for `@itwin/presentation-common`](#itwinpresentation-common) for more details.

## API deprecations

### @itwin/presentation-common

- Deprecated `traverseContent` and `traverseContentItem` in favor of `createContentTraverser` factory function. The change allows caching some state between calls to traverser methods, improving performance when traversing large contents.

  Migration example:

  ```ts
  // before
  traverseContent(myVisitor, content);
  // ... or
  content.contentSet.forEach((item) => traverseContentItem(myVisitor, content.descriptor, item));

  // now
  const traverseContentItems = createContentTraverser(myVisitor, content.descriptor);
  traverseContentItems(content.contentSet);
  // ... or
  const traverseContent = createContentTraverser(myVisitor);
  traverseContent(content.descriptor, content.contentSet);
  ```
