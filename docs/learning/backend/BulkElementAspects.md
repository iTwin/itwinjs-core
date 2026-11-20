# Bulk ElementAspect Operations

[EditTxn.insertAspects]($backend), [EditTxn.updateAspects]($backend) and [EditTxn.deleteAspects]($backend) write many [ElementAspect]($backend)s in one call. The aspects can belong to any number of elements and classes, and [ElementUniqueAspect]($backend)s and [ElementMultiAspect]($backend)s can be mixed.

They are faster than calling [EditTxn.insertAspect]($backend), [EditTxn.updateAspect]($backend) or [EditTxn.deleteAspect]($backend) once per aspect because each owning element is updated once per call, no matter how many of its aspects are written. The single-aspect methods use the same native implementation with one aspect, and still throw an [IModelError]($common).

These methods are `@beta`.

## Choosing a method

Prefer the bulk methods, even for a single aspect. A call with one aspect costs the same as the matching single-aspect method, and a call with many aspects is faster. The single-aspect methods remain for compatibility; the main other difference is that they throw an [IModelError]($common) instead of an [ITwinError]($bentley).

For `updateAspects`, choose the mode by what the caller has at hand:

- **The complete aspect is available**, for example an [ElementAspect]($backend) that was just loaded or a props object that was just built from all its properties: use the default mode and pass the complete props, for example from [ElementAspect.toJSON]($backend). This is the fastest mode because no stored aspect is read.
- **Only the changed properties are available**: pass `{ incremental: true }`. Each aspect is read before it is written, so this mode is slower than the default, but it is cheaper than loading each aspect yourself to build the complete props. It behaves like [EditTxn.updateAspect]($backend).

Never pass partial props in the default mode: every property that is not in the props is set to undefined.

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
- `updateAspects` finds an [ElementMultiAspect]($backend) by `id`, and an [ElementUniqueAspect]($backend) by `element` and `classFullName`. `classFullName` may name a base class of the aspect's class. Unlike [EditTxn.updateAspect]($backend), by default it replaces all the properties of the aspect: pass the complete props, for example from [ElementAspect.toJSON]($backend), because every property that is not in the props is set to undefined. This avoids reading each stored aspect. To change only some properties, pass `{ incremental: true }`: the properties that are not in the props then keep their stored values, at the cost of reading each aspect first.
- `deleteAspects` deletes each id in turn.

## Errors

Each method first validates every input and calls the per-aspect `onInsert`, `onUpdate` or `onDelete` handler, in input order, and throws on the first problem. For example, it throws an [ITwinError]($bentley) for an invalid id, a class that is not an aspect class, or a missing owning element or aspect. An exception thrown by a handler is propagated unchanged, so it may not be an [ITwinError]($bentley). Nothing is written when one of these problems is found, but the handlers before it have already run, so **abandon the txn** with [EditTxn.abandonChanges]($backend) when one of these methods throws anything. An error while writing, for example a SQLite error or an aspect to update or delete that a handler deleted, can also leave some aspects written.

## Handlers

The handlers are called in three passes over the whole call:

1. For each aspect, in input order, the per-aspect `onInsert`, `onUpdate` or `onDelete` handler is called.
2. Each owning element is updated once, in the order in which it first appears in the input. Its `onUpdated` handler is called, then its aspects are written in input order, then its parent's `onChildUpdated` handler is called. As with the single-aspect methods, the element's `onUpdate` handler and its parent's `onChildUpdate` handler are not called.
3. For each aspect, in input order, the per-aspect `onInserted`, `onUpdated` or `onDeleted` handler is called.

As with the single-aspect methods, an owning element's `onUpdated` handler is called before its aspects are written. Unlike a sequence of single-aspect calls, no aspect of the call is written while the `onInsert`, `onUpdate` or `onDelete` handlers run, so a handler that queries the iModel does not see the changes of the other aspects in the same call. All aspects of the call are written before the first `onInserted`, `onUpdated` or `onDeleted` handler is called.

`onDelete` and `onDeleted` receive the owning element in `arg.element`.

## Batch size

The caller chooses the batch size. A call holds the properties of all its aspects in memory at once, so batches of up to a few thousand aspects are recommended.

Group the aspects of one element into the same call when possible: the owning element is then updated once instead of once per call.
