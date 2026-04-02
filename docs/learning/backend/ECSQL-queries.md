# Useful ECSQL Queries

The following ECSQL select statements are examples of useful queries that an app backend or a service might want to perform. They are written in a form that can be executed in backend code.

## Select Elements in a particular Model

```ts
[[include:ECSQL-backend-queries.select-elements-in-model]]
```

## Select Top-Level Elements in a particular Model

```ts
[[include:ECSQL-backend-queries.select-top-level-elements-in-model]]
```

## Select Child Elements

```ts
[[include:ECSQL-backend-queries.select-child-elements]]
```

## Look up element by code value

```ts
[[include:ECSQL-backend-queries.select-element-by-code-value]]
```

## Discover element classes in an iModel

When exploring an unfamiliar iModel, it is useful to see which element classes are present and how many instances of each exist. This query joins element data with the [ECDbMeta](../ECDbMeta.ecschema.md) schema to produce a summary:

```sql
SELECT s.Name || ':' || c.Name ClassName, count(*) InstanceCount
FROM bis.Element e
JOIN meta.ECClassDef c ON e.ECClassId = c.ECInstanceId
JOIN meta.ECSchemaDef s ON s.ECInstanceId = c.Schema.Id
GROUP BY s.Name, c.Name
ORDER BY InstanceCount DESC
```

For more meta query patterns, see the [Meta Queries tutorial](../ECSQLTutorial/MetaQueries.md) and the [ECDbMeta ECSchema reference](../ECDbMeta.ecschema.md).

As an alternative, you can use the [IModelDb.queryEntityIds]($backend) convenience method for simple cases.
