---
publish: false
---
# NextVersion

<!-- prettier-ignore -->
- [NextVersion](#nextversion)
  - [Backend](#backend)
    - [Bulk Element Deletion API changes](#bulk-element-deletion-api-changes)

## Backend

### Bulk Element Deletion API changes

[EditTxn.deleteElements]($backend) *(beta)* is now **all-or-nothing**. Previously the call deleted whatever it could and returned `PartialSuccess` with the ids it had to skip. Now, if any element in the expanded delete set (requested elements plus their children and sub-model contents) is still referenced from *outside* the set, nothing is deleted and the status is `ConstraintViolation`. The validation runs before anything is modified, so a rejected call leaves the iModel and the current txn untouched.

```ts
const result = txn.deleteElements(ids);
if (result.status === BulkDeleteElementsStatus.ConstraintViolation) {
  for (const failure of result.failures)
    console.log(`${failure.elementId}: ${BulkDeleteFailureReason[failure.reason]} ${failure.detail ?? ""}`);
}
```

Changes to the beta types:

- `BulkDeleteElementsStatus.PartialSuccess` has been **removed**. The enum is now `Success` (0), `ConstraintViolation` (1) and `DeletionFailed` (2). Code that handled `PartialSuccess` should handle `ConstraintViolation` instead - and note that in that case *nothing* was deleted.
- New [BulkDeleteElementsResult.failures]($backend): a per-element report. Each [BulkDeleteFailure]($backend) carries the element id, a [BulkDeleteFailureReason]($backend) (`ReferencedByForeignKey`, `DefinitionInUse`, `ProtectedElement` or `ReadOnlyDomain`) and an optional diagnostic `detail` (currently the referencing `table.column` for `ReferencedByForeignKey`, the domain name for `ReadOnlyDomain`). `detail` is for logging only; its format may change, so do not parse it. Only the *direct* violators are reported. Because the whole expanded set is validated, a reported element may be a child or sub-model member that was **not** in the `ids` you passed in; its requested ancestor is not listed separately. For example, requesting `[parent]` when `parent`'s child is the CodeScope of an element outside the set reports the *child*, not `parent`.
- `BulkDeleteElementsResult.failedIds` is deprecated in favor of `failures`. Its contents have changed:
  - On `ConstraintViolation` it holds the unique element ids appearing in `failures`. As described above, these may include cascaded descendants that were not in the requested `ids`, so `failedIds` is no longer guaranteed to be a subset of the input. It is never empty on `ConstraintViolation`, so existing `failedIds.size > 0` checks still detect a rejected delete. However, it no longer lists everything left undeleted: for input `[blocked, independent]`, both remain undeleted while `failedIds` reports only `blocked`. Callers that filter this list to existing elements and throw still detect rejection, but their error reports omit other undeleted elements.
  - On `DeletionFailed` it holds every requested id, matching the previous behavior for this status, so callers that only check `failedIds.size > 0` still detect the failure. The iModel may be partially modified in this case and the caller must abandon the current txn.
  - On `Success` it is empty.
- `BulkDeleteElementsArgs.skipFKConstraintValidations` is deprecated and **ignored**. Skipping the validation pass could leave the iModel with dangling references (e.g. a deleted GeometryPart still used by a geometry stream), so that behavior was removed. The option object is still accepted so existing calls keep compiling.

If you relied on the previous best-effort behavior, inspect `failures` and, for each reported element, either include or update the elements that reference it, or remove it from `ids` together with every requested element it was cascaded from; then call `deleteElements` again. Retries may reveal further violators. Callers that ignored the result, or treated a non-`Success` status as non-fatal, now delete nothing instead of the valid subset.

See [Bulk Element Deletion]($docs/learning/backend/BulkElementDeletion.md) for full details.