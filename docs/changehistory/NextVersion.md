---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Schema sync rework](#schema-sync-rework)
    - [Quantity formatting for text annotation fields](#quantity-formatting-for-text-annotation-fields)
  - [Electron 44 support](#electron-44-support)

## @itwin/core-backend

### Schema sync rework

Schema sync lets the briefcases of one iModel import ECSchemas without taking the exclusive schema lock. This new version explicitly splits between updates, which update the sync db, and upgrades which rewrite the sync db and push it with the briefcase at the same time via the new `BriefcaseDb.upgradeSchemas` API.

Updates no longer automatically end up in other users' briefcases when they import schemas. Instead, they only pick the reference closure of what they import, so updates only hit when a briefcase pushes.

A change that would move or destroy existing data is now refused with `BE_SQLITE_ERROR_DataTransformRequired` or the new `BE_SQLITE_ERROR_DataDeletionRequired`; the new `@alpha` `BriefcaseDb.upgradeSchemas` runs those under the exclusive schema lock and lands the changeset and the sync db together. iModels without schema sync are unaffected.

SchemaSync databases now require version 5.0.0. Existing version 4 containers are outside this compatibility boundary and cannot be opened by this release.

### Quantity formatting for text annotation fields

[FieldRun]($common)s whose target property resolves to a `"quantity"` or `"coordinate"` value are now rendered through the standard iTwin.js quantity formatting pipeline instead of the previous placeholder `toString()` representation. An application adopts a [FormatSet]($ecschema-metadata) for an iModel via the new [ElementDrivesTextAnnotation.registerFieldFormattingProvider]($backend), and individual fields can override the KindOfQuantity, persistence unit, or FormatSet used to format them.

Two changes need attention when upgrading:

- An `int` or `long` property carrying a KindOfQuantity previously rendered as a bare number and now renders as a formatted quantity: one persisting 2500 mm under a KindOfQuantity presenting meters changes from `2500` to `2.5 m`.
- `@itwin/core-quantity` is now a **peer dependency** of both `@itwin/core-common` and `@itwin/core-backend`. Applications that depend on either package but did not already list `@itwin/core-quantity` must add it, at the same version as the rest of their iTwin.js core packages.

See [Quantity formatting for text annotation fields](../learning/backend/TextAnnotationFields.md) for a walkthrough covering format resolution, choosing what to pre-warm, provider lifetime, and evaluating fields.

## Electron 44 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 44](https://www.electronjs.org/blog/electron-44-0).
