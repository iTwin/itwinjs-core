# Change Log - @bentley/map-layers

This log was last generated on Tue, 23 Feb 2021 20:54:45 GMT and should not be manually modified.

## 2.12.1
Tue, 23 Feb 2021 20:54:45 GMT

_Version update only_

## 2.12.0
Thu, 18 Feb 2021 22:10:13 GMT

### Updates

- Provide default props to map-layers widget when used as an extension.
- ArcGIS token-based authentification support: MapLayerManager now monitor provider status and display a warning icon when there is a authentifiation error while loading tiles.  User is allowed to provide credentials without the need to fully re-attach the layer.  Invalid credentials feedback is now provided.  It is now possible to save an ArcGIS layer requiring authentification in the settings service, althoug redentials wont be persisted. 

## 2.11.0
Thu, 28 Jan 2021 13:39:27 GMT

### Updates

- Refreshed MapLayerManager UI. Fixed minor issues with layer dragging order.  Code refactoring.
- Correctly handle WMTS layers (only one layer can be visible at a time)
- Lock react-select to 3.1.0 and @types/react-select to 3.0.26 until we can fix compile errors for later versions.

## 2.10.3
Fri, 08 Jan 2021 18:34:03 GMT

_Version update only_

## 2.10.2
Fri, 08 Jan 2021 14:52:02 GMT

_Version update only_

## 2.10.1
Tue, 22 Dec 2020 00:53:38 GMT

### Updates

- Correctly handle WMTS layers (only one layer can be visible at a time)

## 2.10.0
Fri, 18 Dec 2020 18:24:01 GMT

### Updates

- Move dependencies to peerDependencies

## 2.9.9
Sun, 13 Dec 2020 19:00:03 GMT

_Version update only_

## 2.9.8
Fri, 11 Dec 2020 02:57:36 GMT

_Version update only_

## 2.9.7
Wed, 09 Dec 2020 20:58:23 GMT

_Version update only_

## 2.9.6
Mon, 07 Dec 2020 18:40:48 GMT

_Version update only_

## 2.9.5
Sat, 05 Dec 2020 01:55:56 GMT

_Version update only_

## 2.9.4
Wed, 02 Dec 2020 20:55:40 GMT

_Version update only_

## 2.9.3
Mon, 23 Nov 2020 20:57:56 GMT

_Version update only_

## 2.9.2
Mon, 23 Nov 2020 15:33:50 GMT

_Version update only_

## 2.9.1
Thu, 19 Nov 2020 17:03:42 GMT

_Version update only_

## 2.9.0
Wed, 18 Nov 2020 16:01:50 GMT

_Version update only_

## 2.8.1
Tue, 03 Nov 2020 00:33:56 GMT

_Version update only_

## 2.8.0
Fri, 23 Oct 2020 17:04:02 GMT

### Updates

- Introduced the concept of named/unamed groups and made sure the SubLayers tree view remained consistent with the display (i.e disabling children of non-visible unnamed groups)
- Added optional wms autentication

## 2.7.6
Wed, 11 Nov 2020 16:28:23 GMT

_Version update only_

## 2.7.5
Fri, 23 Oct 2020 16:23:50 GMT

_Version update only_

## 2.7.4
Mon, 19 Oct 2020 17:57:01 GMT

_Version update only_

## 2.7.3
Wed, 14 Oct 2020 17:00:59 GMT

_Version update only_

## 2.7.2
Tue, 13 Oct 2020 18:20:39 GMT

_Version update only_

## 2.7.1
Thu, 08 Oct 2020 13:04:35 GMT

_Version update only_

## 2.7.0
Fri, 02 Oct 2020 18:03:32 GMT

### Updates

- Modify MapUrlDialog to handle MapLayerSettingsService
- Fix background color of bgmap visibility button.
- Added switches to turn on and off the WMS feature of the map layer widget
- Made transparent the visibility button of Mapmanager
- Added optional wms autentication

## 2.6.5
Sat, 26 Sep 2020 16:06:34 GMT

_Version update only_

## 2.6.4
Tue, 22 Sep 2020 17:40:07 GMT

_Version update only_

## 2.6.3
Mon, 21 Sep 2020 14:47:10 GMT

_Version update only_

## 2.6.2
Mon, 21 Sep 2020 13:07:44 GMT

_Version update only_

## 2.6.1
Fri, 18 Sep 2020 13:15:09 GMT

_Version update only_

## 2.6.0
Thu, 17 Sep 2020 13:16:12 GMT

### Updates

- Moved ESLint configuration to a plugin

## 2.5.5
Wed, 02 Sep 2020 17:42:23 GMT

_Version update only_

## 2.5.4
Fri, 28 Aug 2020 15:34:15 GMT

### Updates

- Add Locatable toggle, updated icon for transparency button, add visibilty toggle for 'Base Layer'

## 2.5.3
Wed, 26 Aug 2020 11:46:00 GMT

_Version update only_

## 2.5.2
Tue, 25 Aug 2020 22:09:08 GMT

_Version update only_

## 2.5.1
Mon, 24 Aug 2020 18:13:04 GMT

_Version update only_

## 2.5.0
Thu, 20 Aug 2020 20:57:10 GMT

### Updates

- lock down @types/react version at 16.9.43 to prevent build error from csstype dependency
- Add MapLayersWidgetControl that can be used to specify widget in UI 1.0 FrontstageDef.
- Switch to ESLint

## 2.4.2
Fri, 14 Aug 2020 16:34:09 GMT

### Updates

- Add MapLayersWidgetControl that can be used to specify widget in UI 1.0 FrontstageDef.

## 2.4.1
Fri, 07 Aug 2020 19:57:43 GMT

_Version update only_

## 2.4.0
Tue, 28 Jul 2020 16:26:24 GMT

### Updates

- Add map-layer extension that can also be used as a package. Adds 'Map Layers' widget.

