---
publish: false
---
# NextVersion

## @itwin/core-backend

### Stream element aspects for multiple elements

Use [IModelDb.Elements.getAspectsForElements]($backend) to read the [ElementAspect]($backend) instances owned by a set of elements. The method queries all supplied element Ids together and returns an async iterator, so callers can process each aspect without buffering the complete result set.

Use this method for batch processing, such as exporters and transformers, where calling [IModelDb.Elements.getAspects]($backend) once per element would issue many separate queries. Continue to use `getAspects` when reading a small result from one element and a synchronous array is more convenient.

The options support the same polymorphic `aspectClassFullName` filter as `getAspects`, exact class exclusions, and owner-grouped results. Set `usePrimaryConn` when the query must include uncommitted aspects from an active edit transaction.

```ts
for await (const aspect of iModelDb.elements.getAspectsForElements({
  elementIds,
  aspectClassFullName: ElementMultiAspect.classFullName,
  groupByOwner: true,
})) {
  processAspect(aspect);
}
```

