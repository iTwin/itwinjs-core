# Bulk ElementAspect Operations

[EditTxn.insertAspects]($backend), [EditTxn.updateAspects]($backend) and [EditTxn.deleteAspects]($backend) write many [ElementAspect]($backend)s in one call. The aspects can belong to any number of elements and classes, and [ElementUniqueAspect]($backend)s and [ElementMultiAspect]($backend)s can be mixed.

They are faster than calling [EditTxn.insertAspect]($backend), [EditTxn.updateAspect]($backend) or [EditTxn.deleteAspect]($backend) once per aspect because each owning element is updated once per call, no matter how many of its aspects are written. The single-aspect methods use the same native implementation with one aspect, and still throw an [IModelError]($common).

These methods are `@beta`.

## Basic usage

```typescript
interface MyAspectProps extends ElementAspectProps {
  label: string;
}

const ids = txn.insertAspects([
  { classFullName: "MySchema:MyMultiAspect", element: { id: elementId }, label: "a" },
  { classFullName: "MySchema:MyUniqueAspect", element: { id: elementId }, label: "b" },
] as MyAspectProps[]);
// ids[i] is the Id of the aspect inserted for the i-th props.

txn.updateAspects([
  { classFullName: "MySchema:MyMultiAspect", element: { id: elementId }, id: ids[0], label: "a2" },
  { classFullName: "MySchema:MyUniqueAspect", element: { id: elementId }, label: "b2" },
] as MyAspectProps[]);

txn.deleteAspects([ids[0]]);
```

- `insertAspects` replaces an existing [ElementUniqueAspect]($backend) of the same class, or of a subclass, on the same element. If the same element and class appear more than once in a call, the last one wins.
- `updateAspects` finds an [ElementMultiAspect]($backend) by `id`, and an [ElementUniqueAspect]($backend) by `element` and `classFullName`. `classFullName` may name a base class of the aspect's class. Only the properties in the props are changed.
- `deleteAspects` deletes each id in turn.

## Errors

Each method processes its input in order and throws an [ITwinError]($bentley) on the first problem, for example an invalid id, a class that is not an aspect class, a missing owning element or aspect, or a handler that throws. The aspects before the problem stay written, so **abandon the txn** with [EditTxn.abandonChanges]($backend) when one of these methods throws.

## Handlers

For each aspect, in input order, the per-aspect handler (`onInsert`, `onUpdate` or `onDelete`) is called and then the aspect is written. Once every aspect is written, each owning element is updated once, which calls its `onUpdated` handler and its parent's `onChildUpdate` and `onChildUpdated` handlers. Finally the per-aspect `onInserted`, `onUpdated` or `onDeleted` handlers are called, in input order.

`onDelete` and `onDeleted` receive the owning element in `arg.element`.

## Batch size

The caller chooses the batch size. A call holds the properties of all its aspects in memory at once, so batches of up to a few thousand aspects are recommended.

Group the aspects of one element into the same call when possible: the owning element is then updated once instead of once per call.
