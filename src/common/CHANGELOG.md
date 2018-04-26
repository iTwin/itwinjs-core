# Change Log - @bentley/ecpresentation-common

This log was last generated on Thu, 26 Apr 2018 09:32:56 GMT and should not be manually modified.

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

