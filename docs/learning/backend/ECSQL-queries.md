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

As an alternative, you can use the [IModelDb.queryEntityIds]($backend) convenience method for simple cases.
