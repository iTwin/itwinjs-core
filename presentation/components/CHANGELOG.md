# Change Log - @bentley/presentation-components

This log was last generated on Fri, 28 Sep 2018 00:57:48 GMT and should not be manually modified.

## 0.137.0
Fri, 28 Sep 2018 00:57:48 GMT

*Version update only*

## 0.136.0
Thu, 27 Sep 2018 15:02:45 GMT

*Version update only*

## 0.135.0
Wed, 26 Sep 2018 19:16:30 GMT

*Version update only*

## 0.134.0
Wed, 26 Sep 2018 00:50:11 GMT

*Version update only*

## 0.133.0
Tue, 25 Sep 2018 16:41:02 GMT

### Updates

- FilteredDataProvider has 2 new methods getActiveResultNode and countFilteringResults.
- WithFilteringSupport is now using new nodeHighlightingProps.

## 0.132.0
Mon, 24 Sep 2018 18:55:46 GMT

*Version update only*

## 0.131.0
Sun, 23 Sep 2018 17:07:30 GMT

*Version update only*

## 0.130.0
Sun, 23 Sep 2018 01:19:16 GMT

*Version update only*

## 0.129.0
Fri, 21 Sep 2018 23:16:13 GMT

*Version update only*

## 0.128.0
Fri, 14 Sep 2018 17:08:05 GMT

### Updates

- Fix module names and visibility

## 0.127.0
Thu, 13 Sep 2018 17:07:12 GMT

*Version update only*

## 0.126.0
Wed, 12 Sep 2018 19:12:10 GMT

*Version update only*

## 0.125.0
Wed, 12 Sep 2018 13:35:50 GMT

*Version update only*

## 0.124.0
Tue, 11 Sep 2018 13:52:59 GMT

*Version update only*

## 0.123.0
Wed, 05 Sep 2018 17:14:50 GMT

*Version update only*

## 0.122.0
Tue, 28 Aug 2018 12:25:19 GMT

### Updates

- Modified components to work with ui components changes.
- Added filter string to Tree props

## 0.121.0
Fri, 24 Aug 2018 12:49:09 GMT

*Version update only*

## 0.120.0
Thu, 23 Aug 2018 20:51:32 GMT

*Version update only*

## 0.119.0
Thu, 23 Aug 2018 15:25:49 GMT

*Version update only*

## 0.118.0
Tue, 21 Aug 2018 17:20:41 GMT

### Updates

- TSLint New Rule Enforcements
- Updated to use TypeScript 3.0

## 0.117.0
Wed, 15 Aug 2018 17:08:54 GMT

*Version update only*

## 0.116.0
Wed, 15 Aug 2018 15:13:19 GMT

*Version update only*

## 0.115.0
Tue, 14 Aug 2018 15:21:27 GMT

*Version update only*

## 0.114.0
Tue, 14 Aug 2018 12:04:18 GMT

*Version update only*

## 0.113.0
Fri, 10 Aug 2018 05:06:20 GMT

### Minor changes

- Rename `ECPresentation` to `Presentation`
- Rename package to `presentation-components`

## 0.5.1
Thu, 02 Aug 2018 17:56:36 GMT

### Patches

- Update imodeljs-core dependency versions to 0.109.0
- Specify `main` and `typings` in package.json
- Exclude .scss files from npmignore

## 0.5.0
Tue, 24 Jul 2018 13:20:35 GMT

### Minor changes

- Move Omit & Subtract definitions from `controls` to `common`
- React to changed request options format.

### Patches

- Display current selection content when unified selection component mounts
- Added HOC with filtering support.

## 0.4.0
Fri, 22 Jun 2018 10:25:30 GMT

### Minor changes

- Remove ecpresentation component implementations
- Prefix data providers with ECPresentation

### Patches

- Provide withUnifiedSelection HOCs for each type of CPUB component to create a unified selection component from any base class that uses an ecpresentation-driven data provider
- Update package dependencies

## 0.3.0
Thu, 14 Jun 2018 12:12:59 GMT

### Minor changes

- TFS#901835: TreeView control
- TFS#901837: PropertyPane control
- TFS#901836: TableView control

## 0.2.1
Wed, 23 May 2018 10:15:48 GMT

### Patches

- Update imodeljs-core dependencies to 0.88

## 0.2.0
Fri, 18 May 2018 14:15:29 GMT

### Minor changes

- ContentDataProvider may return no content or descriptor if there is none with the specified parameters.

### Patches

- Fix documentation errors

## 0.1.4
Fri, 11 May 2018 06:57:38 GMT

### Patches

- Update package dependencies.

## 0.1.3
Tue, 08 May 2018 07:05:52 GMT

### Patches

- Fix: Configured descriptor must be of Descriptor class.
- Update imodeljs-core dependencies to 0.80
- Update bentleyjs-core dependency to 8

## 0.1.2
Sun, 29 Apr 2018 08:07:40 GMT

### Patches

- Fixed packaging.

## 0.1.1
Thu, 26 Apr 2018 15:17:48 GMT

### Patches

- Fixed TS2349 which consumers get when using data providers.

## 0.1.0
Thu, 26 Apr 2018 09:27:06 GMT

### Patches

- PresentationManager now accepts keys as KeySets
- ECPresentationManager can now be accessed as singleton through ECPresentation static class
- Selection manager now uses KeySet
- React to ecpresentation API changes

## 0.0.2
Fri, 20 Apr 2018 13:57:47 GMT

### Patches

- Created a new package for ecpresentation-driven controls (moved from @bentley/ecpresentation-frontend)
- Updated package dependencies

