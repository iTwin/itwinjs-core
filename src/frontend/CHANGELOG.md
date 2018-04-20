# Change Log - @bentley/ecpresentation-frontend

This log was last generated on Fri, 20 Apr 2018 13:57:47 GMT and should not be manually modified.

## 0.0.21
Fri, 20 Apr 2018 13:57:47 GMT

### Patches

- Created compound index.ts file that exports package contents so consumers don't have to import each package piece individually through "lib" directory.
- Updated package dependencies
- Setup test coverage
- Moved controls-related code to a separate package @bentley/ecpresentation-controls
- Unified selection

## 0.0.17
Wed, 28 Feb 2018 13:44:55 GMT

### Patches

- Use undefined instead of null
- Return read-only objects
- Use async/await instead of pure promises
- Update imodeljs-frontend dependency to v.0.57.0

## 0.0.16
Tue, 20 Feb 2018 12:06:04 GMT

### Patches

- Update dependencies: bentleyjs-core@5.2.0, imodeljs-backend@0.44.3, imodeljs-nodeaddonapi@6.4.0
- Change content-related classes to interfaces.
- Implemented support for complex properties

## 0.0.15
Fri, 19 Jan 2018 11:51:55 GMT

### Patches

- Some renaming and moving of EC-types
- Use IDisposable interface provided by bentleyjs-core
- Cleaned up Selection API a little
- Fixed tree and content data providers to create valid request options
- Use imodeljs-frontend v0.23.0

## 0.0.14
Mon, 08 Jan 2018 14:51:31 GMT

### Patches

- Some restructuring to make the code more maintainable.
- Use imodeljs-frontend@0.12.0

