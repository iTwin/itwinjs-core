# Changelog
All notable changes to this project will be documented in this file.  
The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0]  -  2018-06-20
### Added
- Synchronous methods for most things.

### Fixed
- Json SchemaLocater now loads the contents of a schema, not just an empty shell

### Changed
- Schema locaters now do not load a full graph of schemas, but only a single one, they call back through SchemaContext for loading references
- Moved caching from schema locaters into SchemaContext only
- Classes now hold a collection of properties instead of LazyLoadedProperty

<!-- This is a slightly better formatting in the VSCode markdown preview: -->
<style>
  h2 > a { font-weight: 600; }
  h2::after { content:''; display: block; border-bottom: 1px solid currentColor; opacity: .25 }
</style>
