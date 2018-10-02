# Wire Format

The *wire format* describes is the way entities are serialized to JSON.

Below are examples of wire formats for a few interesting iModel.js classes.

## Root Subject

The following code:

```ts
[[include:WireFormat_RootSubject.code]]
```

Produces the following result:

```json
[[include:WireFormat_RootSubject.json]]
```

-------------------------------------------------

## RepositoryModel

The following code:

```ts
[[include:WireFormat_RepositoryModel.code]]
```

Produces the following result:

```json
[[include:WireFormat_RepositoryModel.json]]
```

-------------------------------------------------

## GeometricElement3d

The following code produces JSON at various stages on the way to creating a `GeometricElement3d`:

```ts
[[include:WireFormat_GeometricElement3d.code]]
```

### Arc3d JSON

Below is the JSON from the `Arc3d`:

```json
[[include:WireFormat_GeometricElement3d_Arc.json]]
```

### LineString3d JSON

Below is the JSON from the `LineString3d`:

```json
[[include:WireFormat_GeometricElement3d_LineString.json]]
```

### GeometryStream JSON

Below is the JSON from the `GeometryStream` that contains the `Arc3d` and `LineString3d` that were previously created.
This shows that a `GeometryStream` is just an array of entries:

```json
[[include:WireFormat_GeometricElement3d_GeometryStream.json]]
```

### Placement3d JSON

Below is the JSON from the `Placement3d` that will be used to place the `GeometryStream` in world coordinates:

```json
[[include:WireFormat_GeometricElement3d_Placement.json]]
```

### GeometricElement3d JSON

Below is the JSON from the `GeometricElement3d`.
This shows that the JSON from the `GeometricElement3d` contains the JSON from the objects used to create it:

```json
[[include:WireFormat_GeometricElement3d_Element.json]]
```

-------------------------------------------------
