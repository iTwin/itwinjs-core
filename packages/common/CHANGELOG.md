# Change Log - @bentley/ecpresentation-common

This log was last generated on Wed, 23 May 2018 10:15:48 GMT and should not be manually modified.

## 0.3.1
Wed, 23 May 2018 10:15:48 GMT

### Patches

- Update imodeljs-core dependencies to 0.88

## 0.3.0
Fri, 18 May 2018 14:15:29 GMT

### Minor changes

- Added interfaces for presentation rules.
- ECPresentationManager.getContentDescriptor may return no descriptor if there is none with the specified parameters.

### Patches

- Add missing documentation
- Use ECPresentationError instead of generic Error.

## 0.2.0
Fri, 11 May 2018 06:57:38 GMT

### Minor changes

- React to Gateway's API changes: renamed ECPresentationGateway to ECPresentationRpcInterface.

## 0.1.2
Tue, 08 May 2018 07:05:52 GMT

### Patches

- 100% unit test coverage
- Fix Changes.js.map being included into the package.
- Update imodeljs-core dependencies to 0.80
- Update bentleyjs-core dependency to 8

## 0.1.1
Sun, 29 Apr 2018 08:07:40 GMT

### Patches

- Fixed packaging.

## 0.1.0
Thu, 26 Apr 2018 09:27:06 GMT

### Patches

- Added a KeySet and PersistentKeysContainer definition. Changed InstanceKey definition to store class name instead of id.
- KeySet (de)serialization for passing over gateway / addon boundary
- PresentationManager now accepts keys as KeySets
- Fixed node keys deserialization.
- Readonly-ness fixes
- KeySet can now work with other KeySets or SerializedKeySets
- API cleanup
- Stop using intermediate JSON format for data objects

## 0.0.5
Fri, 20 Apr 2018 13:57:47 GMT

### Patches

- Created compound index.ts file that exports package contents so consumers don't have to import each package piece individually through "lib" directory.
- Updated package dependencies

## 0.0.1
Wed, 28 Feb 2018 13:44:55 GMT

### Patches

- Created a new package for common ecpresentation classes / utils.

