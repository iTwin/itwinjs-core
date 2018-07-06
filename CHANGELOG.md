# Changelog
All notable changes to this project will be documented in this file.  
The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Added Units as a first-class concept in a Schema
- Added InvertedUnit class- a specific type of Unit that describes the inverse of a single Unit
- Added Constant class- a specific type of Unit that represents a number
- Added Phenomenon class
- Added UnitSystem class
- Added Formats as a first-class concept in a Schema; includes Composite, which defines additional information about a format
- Added support for Format String- a short string-based representation of a Format, which allows overriding certain key properties of a Format.

### Changed
- KindOfQuantity now enables references to Units and Formats defined in schemas
- Changed ECEnumerator specification and required attributes
- ec-js now supports deserializing into DelayedPromise

### Fixed
- Getting inherited properties that are in mixins works in synchronous code, too. There were some missing sync methods.

### Removed
- Removed SchemaReadHelper.to() and SchemaReadHelper.toSync() as public callers should go through Schema.fromJson() instead. SchemaReadHelper can still be constructed publicly to mimic the to() methods.
- Removed some unused internal code

## [0.6.1]  -  2018-06-21
### Fixed

- Navigation Properties in Mixin classes should now load correctly when loading them synchronously

## [0.6.0]  -  2018-06-20
### Added
- Synchronous methods for most things.

### Fixed
- Json SchemaLocater now loads the contents of a schema, not just an empty shell

### Changed
- Schema locaters now do not load a full graph of schemas, but only a single one, they call back through SchemaContext for loading references
- Moved caching from schema locaters into SchemaContext only
- Classes now hold a collection of properties instead of LazyLoadedProperty

[Unreleased]: https://tfs.bentley.com/tfs/ProductLine/Platform%20Technology/ECSchema%20Editor/_git/ec-js/branches?_a=commits&baseVersion=GT0.6.1&targetVersion=GBmaster
[0.6.1]: https://tfs.bentley.com/tfs/ProductLine/Platform%20Technology/ECSchema%20Editor/_git/ec-js/branches?_a=commits&baseVersion=GT0.6.0&targetVersion=GT0.6.1
[0.6.0]: https://tfs.bentley.com/tfs/ProductLine/Platform%20Technology/ECSchema%20Editor/_git/ec-js/branches?_a=commits&baseVersion=GT0.5.3&targetVersion=GT0.6.0
[0.5.3]: https://tfs.bentley.com/tfs/ProductLine/Platform%20Technology/ECSchema%20Editor/_git/ec-js/branches?_a=commits&baseVersion=GT0.5.2&targetVersion=GT0.5.3
[0.5.2]: https://tfs.bentley.com/tfs/ProductLine/Platform%20Technology/ECSchema%20Editor/_git/ec-js/branches?_a=commits&baseVersion=GT0.5.1&targetVersion=GT0.5.2
[0.5.1]: https://tfs.bentley.com/tfs/ProductLine/Platform%20Technology/ECSchema%20Editor/_git/ec-js/branches?_a=commits&baseVersion=GT0.5.0&targetVersion=GT0.5.1
[0.5.0]: https://tfs.bentley.com/tfs/ProductLine/Platform%20Technology/ECSchema%20Editor/_git/ec-js/branches?_a=commits&baseVersion=GT0.0.1&targetVersion=GT0.5.0

<!-- This is a slightly better formatting in the VSCode markdown preview: -->
<style>
  h2 > a { font-weight: 600; }
  h2::after { content:''; display: block; border-bottom: 1px solid currentColor; opacity: .25 }
</style>
