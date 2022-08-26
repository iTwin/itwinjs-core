# Change Log - @itwin/map-layers

This log was last generated on Fri, 26 Aug 2022 15:40:02 GMT and should not be manually modified.

## 3.3.1
Fri, 26 Aug 2022 15:40:02 GMT

_Version update only_

## 3.3.0
Thu, 18 Aug 2022 19:08:02 GMT

### Updates

- upgrade mocha to version 10.0.0
- Fixed FeatureInfo provider registration when Map Layers Widget is initialized.
- Update iTwinUI-react to 1.38.1

## 3.2.9
Fri, 26 Aug 2022 14:21:40 GMT

_Version update only_

## 3.2.8
Tue, 09 Aug 2022 15:52:41 GMT

_Version update only_

## 3.2.7
Mon, 01 Aug 2022 13:36:56 GMT

_Version update only_

## 3.2.6
Fri, 15 Jul 2022 19:04:43 GMT

_Version update only_

## 3.2.5
Wed, 13 Jul 2022 15:45:53 GMT

### Updates

- Use a different resize observer technique to ensure the controlled tree in map suplayer popup is properly sized.
- Turned ON Popup's 'repositionOnResize' property for MapLayerSettingsMenu.

## 3.2.4
Tue, 21 Jun 2022 18:06:33 GMT

_Version update only_

## 3.2.3
Fri, 17 Jun 2022 15:18:39 GMT

### Updates

- Made public MapLayers related objects, methods.

## 3.2.2
Fri, 10 Jun 2022 16:11:37 GMT

_Version update only_

## 3.2.1
Tue, 07 Jun 2022 15:02:57 GMT

_Version update only_

## 3.2.0
Fri, 20 May 2022 13:10:54 GMT

### Updates

- maplayers widget has been updated to support OAuth2: if needed, a popup window will be displayed to trigger the external OAuth process. When process completes, the focus returns to the map-layers widget and layer is ready to be added/displayed.
- Use iTwinUI-react components to get consistent styling. Alos fixed bug with elevation correction control.
- Fix a display issue with background color's ColorPicker where part of the dialog was missing.
- Add ability to pass parameters to UiItemsManager when loading items provider to specify what stages allow the provider to supply items.

## 3.1.3
Fri, 15 Apr 2022 13:49:25 GMT

_Version update only_

## 3.1.2
Wed, 06 Apr 2022 22:27:56 GMT

_Version update only_

## 3.1.1
Thu, 31 Mar 2022 15:55:48 GMT

### Updates

- Adjusted the map-layers package's peer dependencies to no longer lock down core packages.

## 3.1.0
Tue, 29 Mar 2022 20:53:47 GMT

### Updates

- Add support for map layers using model geometry.
- User Preferences is now supported for Blank Connection configurations.
- Fixed issue that would close the new maplayer dialog when a new layer type was picked.
- Fix 'ResizeObserver loop limit exceeded' error in MapLayers widget
- Added FeatureInfo Widget.
- Bug fix: Right click on the new map layer dialog would close it.
- Refactored MapLayersUI initialization, and will always use UiProviders
- Fix style on select
- Update to itwinui-css version "0.44.0".
- Update to @itwin/itwinui-react: 1.32.0
- Update to latest itwinui-react - requires new compile option allowSyntheticDefaultImports=true.

## 3.0.3
Fri, 25 Mar 2022 15:10:02 GMT

_Version update only_

## 3.0.2
Thu, 10 Mar 2022 21:18:13 GMT

_Version update only_

## 3.0.1
Thu, 24 Feb 2022 15:26:55 GMT

_Version update only_

## 3.0.0
Mon, 24 Jan 2022 14:00:52 GMT

### Updates

- Upgrade target to ES2019 and deliver both a CommonJs and ESModule version of package
- Layers could not be added through MapLayers widget when UserPreferences was not set. Fix various issues related to user preferences.
- Fixed various CSS issues in map-layers widget after recent UI framework changes.
- No longer display username/password fields by default in the custom map layers dialog: If validation fails and reports authentication is needed, we then ask end-user for credentials.
- Use QuantityNumericInput for 'Elevation Offset' and 'Model Height' fields instead of hardcoded units.
- Migrated from Toggle to ToggleSwitch component in map-layers widget
- rename contextId -> iTwinId
- Unregister maplayers itemsProvider and widget control on terminate.
- Now use 'DisplayStyleState.backgroundMapBase' instead of 'DisplayStyleState.changeBaseMapProps' to update the mapImagery.
- use new @itwin package names
- rename to @itwin/map-layers
- remove ClientRequestContext and its subclasses
- Replace usage of I18N with generic Localization interface.
-  Renamed an iModel's parent container to iTwin
- Ignore lint warning for deprecated class
- Upgraded itwinui-react to 1.16.2. Fixed editor sizes.
- Update to latest itwinui-react
- Incorporating iTwinUI-CSS and iTwinUI-React into iModel.js
- Update to React 17.
- Created imodel-components folder & package and moved color, lineweight, navigationaids, quantity, timeline & viewport. Deprecated MessageSeverity in ui-core & added it ui-abstract. Added MessagePresenter interface to ui-abstract.
- Replace deprecated ThemedSelect component with iTwinUI-react Select component.
- Remove itwinUi css overrides.
- Replaced ui-core Slider with one from iTwinUi-react.
- Update to latest types/react package
- Lock down and update version numbers so docs will build.

## 2.19.28
Wed, 12 Jan 2022 14:52:38 GMT

_Version update only_

## 2.19.27
Wed, 05 Jan 2022 20:07:20 GMT

_Version update only_

## 2.19.26
Wed, 08 Dec 2021 20:54:53 GMT

_Version update only_

## 2.19.25
Fri, 03 Dec 2021 20:05:49 GMT

_Version update only_

## 2.19.24
Mon, 29 Nov 2021 18:44:31 GMT

### Updates

- Fixed UI spacing issues in map-layers widget.

## 2.19.23
Mon, 22 Nov 2021 20:41:40 GMT

_Version update only_

## 2.19.22
Wed, 17 Nov 2021 01:23:26 GMT

_Version update only_

## 2.19.21
Wed, 10 Nov 2021 10:58:24 GMT

_Version update only_

## 2.19.20
Fri, 29 Oct 2021 16:14:22 GMT

### Updates

- Added Mask transparency to map-layers widget.

## 2.19.19
Mon, 25 Oct 2021 16:16:25 GMT

### Updates

- Drop unnecessary dep on @bentley/react-scripts

## 2.19.18
Thu, 21 Oct 2021 20:59:44 GMT

_Version update only_

## 2.19.17
Thu, 14 Oct 2021 21:19:43 GMT

_Version update only_

## 2.19.16
Mon, 11 Oct 2021 17:37:46 GMT

_Version update only_

## 2.19.15
Fri, 08 Oct 2021 16:44:23 GMT

_Version update only_

## 2.19.14
Fri, 01 Oct 2021 13:07:03 GMT

_Version update only_

## 2.19.13
Tue, 21 Sep 2021 21:06:40 GMT

_Version update only_

## 2.19.12
Wed, 15 Sep 2021 18:06:46 GMT

_Version update only_

## 2.19.11
Thu, 09 Sep 2021 21:04:58 GMT

_Version update only_

## 2.19.10
Wed, 08 Sep 2021 14:36:01 GMT

_Version update only_

## 2.19.9
Wed, 25 Aug 2021 15:36:01 GMT

_Version update only_

## 2.19.8
Mon, 23 Aug 2021 13:23:13 GMT

_Version update only_

## 2.19.7
Fri, 20 Aug 2021 17:47:22 GMT

_Version update only_

## 2.19.6
Tue, 17 Aug 2021 20:34:29 GMT

_Version update only_

## 2.19.5
Fri, 13 Aug 2021 21:48:09 GMT

_Version update only_

## 2.19.4
Thu, 12 Aug 2021 13:09:26 GMT

_Version update only_

## 2.19.3
Wed, 04 Aug 2021 20:29:34 GMT

_Version update only_

## 2.19.2
Tue, 03 Aug 2021 18:26:23 GMT

_Version update only_

## 2.19.1
Thu, 29 Jul 2021 20:01:11 GMT

_Version update only_

## 2.19.0
Mon, 26 Jul 2021 12:21:25 GMT

_Version update only_

## 2.18.4
Tue, 10 Aug 2021 19:35:13 GMT

_Version update only_

## 2.18.3
Wed, 28 Jul 2021 17:16:30 GMT

_Version update only_

## 2.18.2
Mon, 26 Jul 2021 16:18:31 GMT

_Version update only_

## 2.18.1
Fri, 16 Jul 2021 17:45:09 GMT

_Version update only_

## 2.18.0
Fri, 09 Jul 2021 18:11:24 GMT

_Version update only_

## 2.17.3
Mon, 26 Jul 2021 16:08:36 GMT

_Version update only_

## 2.17.2
Thu, 08 Jul 2021 15:23:00 GMT

_Version update only_

## 2.17.1
Fri, 02 Jul 2021 15:38:31 GMT

_Version update only_

## 2.17.0
Mon, 28 Jun 2021 16:20:11 GMT

### Updates

-  Allow saved map-layer definition to be edited.
- Made MaplayerSource independent from MapLayerProps.
- MapManagerSettings UI Refresh. Added tests.
- Fixed typo in activeViewport.view.isSpatialView: it should be invoked as a method and not a property.
- Fixed a bug where an elevation offset value of 0 could not be in the UI.

## 2.16.10
Thu, 22 Jul 2021 20:23:45 GMT

_Version update only_

## 2.16.9
Tue, 06 Jul 2021 22:08:34 GMT

_Version update only_

## 2.16.8
Fri, 02 Jul 2021 17:40:46 GMT

_Version update only_

## 2.16.7
Mon, 28 Jun 2021 18:13:04 GMT

_Version update only_

## 2.16.6
Mon, 28 Jun 2021 13:12:55 GMT

_Version update only_

## 2.16.5
Fri, 25 Jun 2021 16:03:01 GMT

_Version update only_

## 2.16.4
Wed, 23 Jun 2021 17:09:07 GMT

_Version update only_

## 2.16.3
Wed, 16 Jun 2021 20:29:32 GMT

_Version update only_

## 2.16.2
Thu, 03 Jun 2021 18:08:11 GMT

_Version update only_

## 2.16.1
Thu, 27 May 2021 20:04:22 GMT

_Version update only_

## 2.16.0
Mon, 24 May 2021 15:58:39 GMT

### Updates

- Fix 'npm run cover' that would never complete. 
- Exposed the map masking option in the map layers settings UI.
- Move map tile trees to Viewport to handle synching correctly
- Update to latest classnames package

## 2.15.6
Wed, 26 May 2021 15:55:19 GMT

_Version update only_

## 2.15.5
Thu, 20 May 2021 15:06:26 GMT

_Version update only_

## 2.15.4
Tue, 18 May 2021 21:59:07 GMT

_Version update only_

## 2.15.3
Mon, 17 May 2021 13:31:38 GMT

_Version update only_

## 2.15.2
Wed, 12 May 2021 18:08:13 GMT

_Version update only_

## 2.15.1
Wed, 05 May 2021 13:18:31 GMT

_Version update only_

## 2.15.0
Fri, 30 Apr 2021 12:36:58 GMT

### Updates

- Allow saved map layer definition to be deleted from setting service.
- Fixed typo in the message when the iModel is not geolocated.

## 2.14.4
Thu, 22 Apr 2021 21:07:33 GMT

_Version update only_

## 2.14.3
Thu, 15 Apr 2021 15:13:16 GMT

_Version update only_

## 2.14.2
Thu, 08 Apr 2021 14:30:09 GMT

_Version update only_

## 2.14.1
Mon, 05 Apr 2021 16:28:00 GMT

_Version update only_

## 2.14.0
Fri, 02 Apr 2021 13:18:42 GMT

### Updates

- WMS/WMTS layers will now provide feedback to end-user when an unauthorized error is returned by server. Enabled tests in map-layers extensions.

## 2.13.0
Tue, 09 Mar 2021 20:28:13 GMT

### Updates

- Restored base layer visibility button in map manager. 
- Updated to use TypeScript 4.1
- begin rename project from iModel.js to iTwin.js

## 2.12.3
Mon, 08 Mar 2021 15:32:00 GMT

_Version update only_

## 2.12.2
Wed, 03 Mar 2021 18:48:53 GMT

_Version update only_

## 2.12.1
Tue, 23 Feb 2021 20:54:45 GMT

_Version update only_

## 2.12.0
Thu, 18 Feb 2021 22:10:13 GMT

### Updates

- Provide default props to map-layers widget when used as an extension.
- ArcGIS token-based authentification support: MapLayerManager now monitor provider status and display a warning icon when there is a authentifiation error while loading tiles.  User is allowed to provide credentials without the need to fully re-attach the layer.  Invalid credentials feedback is now provided.  It is now possible to save an ArcGIS layer requiring authentification in the settings service, althoug redentials wont be persisted. 

## 2.11.2
Thu, 18 Feb 2021 02:50:59 GMT

_Version update only_

## 2.11.1
Thu, 04 Feb 2021 17:22:41 GMT

_Version update only_

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

