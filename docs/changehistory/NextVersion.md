---
publish: false
---

- [@itwin/presentation-common](#itwinpresentation-common)
  - [Additions](#additions)
  - [Fixes](#fixes)

## @itwin/presentation-common

### Additions

- Added `parentArrayField` and `parentStructField` attributes to `PropertiesField` class to allow easier navigation to parent fields when traversing content. The new properties, together with `parent` property, are mutually exclusive, i.e., only one of them can be defined at a time (a field can't be a struct member and an array item field at the same time).
- Added `getFieldByName` method to `ArrayPropertiesField` and `StructPropertiesField`.
  - For array field, the method returns items field if its name matches the given name.
  - For struct field, the method returns the member field with the given name, if any.

### Fixes

- Fixed content traverser (result of `createContentTraverser` call) not passing parent struct / array field names as `parentFieldName` to `IContentVisitor` methods.
