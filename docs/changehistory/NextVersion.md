---
publish: false
---

# NextVersion

- [NextVersion](#nextversion)
  - [Node.js 24 support](#nodejs-24-support)
  - [Schema table locks for concurrent schema modifications](#schema-table-locks-for-concurrent-schema-modifications)

## Node.js 24 support

In addition to [already supported Node.js versions](../learning/SupportedPlatforms.md#supported-nodejs-versions), iTwin.js now supports [Node.js 24](https://nodejs.org/en/blog/release/v24.11.0).

## Schema table locks for concurrent schema modifications

A new locking mechanism has been introduced to improve concurrency when importing schemas in multi-user scenarios. Previously, any schema import required an exclusive lock over the entire iModel file, blocking all other users.

The system now distinguishes between:

- **Schema table lock** - Used for trivial schema changes (e.g., adding properties or classes) that don't require data transformation. This lock only blocks concurrent schema imports, allowing other users to continue modifying element data.
- **Full schema lock** - Required when schema changes necessitate data transformation.

This feature is exposed through a beta flag in `IModelHostOptions`:

```typescript
IModelHost.startup({
  enableSchemaTableLocks: true
});
```

For more details about reserved element IDs used for lock management, see [iModel File Format](../learning/backend/IModelFileFormat.md).
