---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [WithQueryReader API](#withqueryreader-api)
  - [Display](#display)
    - [Fixes](#fixes)

## @itwin/core-backend

### WithQueryReader API

A new [withQueryReader]($docs/learning/backend/WithQueryReaderCodeExamples.md) method has been added to both [ECDb]($backend) and [IModelDb]($backend), providing true row-by-row behavior for ECSQL queries with synchronous execution. This API introduces a new [ECSqlSyncReader]($backend) through the [ECSqlRowExecutor]($backend) and supports configuration via [SynchronousQueryOptions]($backend).

**Key Features:**

- **True row-by-row streaming**: Unlike the existing async reader APIs, `withQueryReader` provides synchronous row-by-row access to query results
- **Consistent API across databases**: The same interface is available on both `ECDb` and `IModelDb` instances
- **Configurable behavior**: Support for various query options through `SynchronousQueryOptions`

**Usage Examples:**

```typescript
// ECDb usage
db.withQueryReader("SELECT ECInstanceId, UserLabel FROM bis.Element LIMIT 100", (reader) => {
  while (reader.step()) {
    const row = reader.current;
    console.log(`ID: ${row.id}, Label: ${row.userLabel}`);
  }
});

// IModelDb usage with options
iModelDb.withQueryReader(
  "SELECT ECInstanceId, CodeValue FROM bis.Element",
  (reader) => {
    while (reader.step()) {
      const row = reader.current;
      processElement(row);
    }
  }
);
```

**Migration from deprecated APIs:**

This API serves as the recommended replacement for synchronous query scenarios previously handled by the deprecated `ECSqlStatement` for read-only operations:

```typescript
// Before - using deprecated ECSqlStatement
db.withPreparedStatement(query, (stmt) => {
  while (stmt.step() === DbResult.BE_SQLITE_ROW) {
    const row = stmt.getRow();
    processRow(row);
  }
});

// Now - using withQueryReader
db.withQueryReader(query, (reader) => {
  while (reader.step()) {
    const row = reader.current;
    processRow(row);
  }
});
```

## Display

### Fixes

- Fixed reality data geometry not being reprojected correctly when the reality data is in a different CRS than the iModel.
