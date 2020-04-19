# Change Log - @bentley/geo-photo-plugin

This log was last generated on Wed, 04 Mar 2020 16:16:31 GMT and should not be manually modified.

## 1.13.0
Wed, 04 Mar 2020 16:16:31 GMT

*Version update only*

## 1.12.0
Wed, 12 Feb 2020 17:45:50 GMT

### Updates

- Consolidated sign-in across packages for integration tests
- Renamed the folder and name of tests that run both the frontend and backend to "fullstack" instead of "integration". 
- EN: #124601 - Initial implementation of WebGL2

## 1.11.0
Wed, 22 Jan 2020 19:24:12 GMT

### Updates

- Upgrade to TypeScript 3.7.2.

## 1.10.0
Tue, 07 Jan 2020 19:44:01 GMT

### Updates

- merge
- Fix behavior when no photos (Bug 205812)
- Eliminate markers in panorama view that are too far to the side. Added Tab to UI for settings.
- Added a way to orient the markers shown in pannellum viewer
- Update package location of PluginUiManager.

## 1.9.0
Tue, 10 Dec 2019 18:08:56 GMT

### Updates

- Fix bug finding close neighbors when changing displayed folders
- Bug in finding close neighbors. Track added to tool tip
- Disallow plugins from adding tools anywhere but the end of a toolbar.
- No longer accessing this.state or this.props in setState updater - flagged by lgtm report

## 1.8.0
Fri, 22 Nov 2019 14:03:34 GMT

### Updates

- Added user interface to show progress and allow selection of folders.

## 1.7.0
Fri, 01 Nov 2019 13:28:37 GMT

### Updates

- Fixes and improvements to reading image tags. 
- Fix for tooltip and z position
- Optimize conversion of photo geoLocations to spatial coordinates
- Use internal pannellum viewer on ctrl-click. Change color of visited panos.

## 1.6.0
Wed, 09 Oct 2019 20:28:42 GMT

### Updates

- Added licensing notice. 
- Initial publish of the Geo-Photo Plugin
- Refactored geoPhoto plugins to allow for tests in chrome and node.js

