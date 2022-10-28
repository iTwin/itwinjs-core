# Implement A Dynamic Schema

## Table of Contents

- [Implement A Dynamic Schema](#implement-a-dynamic-schema)
  - [Table of Contents](#table-of-contents)
  - [Example](#example)
    - [Synch the Dynamic Schema](#synch-the-dynamic-schema)
    - [Register the Dynamic Schema](#register-the-dynamic-schema)
    - [Create the Dynamic Schema](#create-the-dynamic-schema)

## Example

Complete source is available [DynamicSchema.ts](https://github.com/iTwin/pcf/blob/main/core/src/DynamicSchema.ts) from [Parametric Connector Framework](https://github.com/iTwin/pcf)

### Synch the Dynamic Schema

Create the schema, compare it with existing version schema if it exists, register the schema if its either new or changed from previous version

```ts
[[include:DynamicSchema-syncDynamicSchema.example-code]]
```

### Register the Dynamic Schema

First unregister if already registered in case of upgrading schema, then register current version of schema

```ts
[[include:DynamicSchema-registerDynamicSchema.example-code]]
```

### Create the Dynamic Schema

Iterate through classes and properties and add them to the schema

```ts
[[include:DynamicSchema-createDynamicSchema.example-code]]
```
