# Change Log - @bentley/ecpresentation-backend

This log was last generated on Fri, 11 May 2018 06:59:50 GMT and should not be manually modified.

## 0.2.0
Fri, 11 May 2018 06:57:38 GMT

### Minor changes

- React to Gateway's API changes: renamed ECPresentationGateway to ECPresentationRpcImpl.
- Make ECPresentationManager IDisposable to properly terminate native resources.

## 0.1.2
Tue, 08 May 2018 07:05:52 GMT

### Patches

- 100% unit test coverage
- Update imodeljs-core dependencies to 0.80
- Update bentleyjs-core dependency to 8

## 0.1.1
Sun, 29 Apr 2018 08:07:40 GMT

### Patches

- Fixed packaging.

## 0.1.0
Thu, 26 Apr 2018 09:27:06 GMT

### Patches

- Ids are now Id64. InstanceKey now stores class name instead of id.
- PresentationManager now accepts keys as KeySets
- Added a static ECPresentation class which provides access to singleton ECPresentationManager
- Readonly-ness fixes
- React to ecpresentation-common API changes

## 0.0.32
Fri, 20 Apr 2018 13:57:47 GMT

### Patches

- Updated package dependencies
- Created compound index.ts file that exports package contents so consumers don't have to import each package piece individually through "lib" directory.
- Setup test coverage

## 0.0.28
Wed, 28 Feb 2018 13:44:55 GMT

### Patches

- Use undefined instead of null
- Return read-only objects
- Use async/await instead of pure promises
- Update imodeljs-backend dependency to v.0.57.0

## 0.0.27
Tue, 20 Feb 2018 12:06:04 GMT

### Patches

- Update dependencies: bentleyjs-core@5.2.0, imodeljs-frontend@0.44.2
- Fixed content descriptor customization.
- Change content-related classes to interfaces.
- Implemented support for complex properties

## 0.0.26
Fri, 19 Jan 2018 11:51:55 GMT

### Patches

- Some renaming and moving of EC-types
- Added ability to configure presentation manager to use an app-supplied assets directory for finding app's presentation rulesets.
- Use node addon v3.1.0 and imodeljs-backend v0.24.0

## 0.0.25
Mon, 08 Jan 2018 14:51:31 GMT

### Patches

- Some restructuring to make the code more maintainable.
- Use imodeljs-backend@0.15.0

