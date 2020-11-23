# Change Log - @bentley/hypermodeling-frontend

This log was last generated on Mon, 23 Nov 2020 22:19:30 GMT and should not be manually modified.

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

### Updates

- Add 'forcePrune' method to tile tree to adhere to new TileTree pattern.

## 2.8.1
Tue, 03 Nov 2020 00:33:56 GMT

_Version update only_

## 2.8.0
Fri, 23 Oct 2020 17:04:02 GMT

_Version update only_

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
Tue, 13 Oct 2020 18:20:38 GMT

_Version update only_

## 2.7.1
Thu, 08 Oct 2020 13:04:35 GMT

_Version update only_

## 2.7.0
Fri, 02 Oct 2020 18:03:32 GMT

_Version update only_

## 2.6.5
Sat, 26 Sep 2020 16:06:34 GMT

_Version update only_

## 2.6.4
Tue, 22 Sep 2020 17:40:07 GMT

_Version update only_

## 2.6.3
Mon, 21 Sep 2020 14:47:09 GMT

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

_Version update only_

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
Thu, 20 Aug 2020 20:57:09 GMT

### Updates

- Cache decorations for hypermodeling decorator.
- Use IModelRoutingContext
- Add tools to override primary model appearances
- Switch to ESLint

## 2.4.2
Fri, 14 Aug 2020 16:34:09 GMT

_Version update only_

## 2.4.1
Fri, 07 Aug 2020 19:57:43 GMT

### Updates

- Add missing assets to published package

## 2.4.0
Tue, 28 Jul 2020 16:26:24 GMT

### Updates

- HyperModeling.isSupportedForIModel returns false if no section drawing locations exist, as advertised.
- Applications can now customize the visibility of section markers.

## 2.3.3
Thu, 23 Jul 2020 12:57:15 GMT

### Updates

- Add missing assets to published package

## 2.3.2
Tue, 14 Jul 2020 23:50:36 GMT

_Version update only_

## 2.3.1
Mon, 13 Jul 2020 18:50:13 GMT

_Version update only_

## 2.3.0
Fri, 10 Jul 2020 17:23:14 GMT

### Updates

- Clean up API; add customization points.
- Reset active section marker when a new view is applied to the viewport; add HyperModeling.isActive() and HyperModelingDecorator.alignToSpatialView(); HyperModelingDecorator.toggleSection() does not apply the spatial view, only its frustum and clip volume.
- Convert hypermodeling extension into hypermodeling-frontend package.

## 2.2.1
Tue, 07 Jul 2020 14:44:52 GMT

_Version update only_

## 2.2.0
Fri, 19 Jun 2020 14:10:03 GMT

### Updates

- Add toolbar option to navigate to view attachment from section marker.

## 2.1.0
Thu, 28 May 2020 22:48:59 GMT

_Version update only_

## 2.0.0
Wed, 06 May 2020 13:17:49 GMT

### Updates

- New hyper modeling marker images.
- react to changes in imodeljs-clients
- Upgrade to Rush 5.23.2
- #301812 #288370 Fix label font specifications. Added max label width option to Marker.
- Rename the hypermodeling-plugin to hypermodeling-extension
- Update to use UiItemManager
- Update to support new iModel.js Extension build system and drop support for the iModel.js module system.

## 1.14.1
Wed, 22 Apr 2020 19:04:00 GMT

_Version update only_

## 1.14.0
Tue, 31 Mar 2020 15:44:19 GMT

_Version update only_

## 1.13.0
Wed, 04 Mar 2020 16:16:31 GMT

_Version update only_

## 1.12.0
Wed, 12 Feb 2020 17:45:50 GMT

_Version update only_

## 1.11.0
Wed, 22 Jan 2020 19:24:12 GMT

### Updates

- Upgrade to TypeScript 3.7.2.

## 1.10.0
Tue, 07 Jan 2020 19:44:01 GMT

_Version update only_

## 1.9.0
Tue, 10 Dec 2019 18:08:56 GMT

### Updates

- Add iModelJs.buildModule.installTo property to package.json

## 1.8.0
Fri, 22 Nov 2019 14:03:34 GMT

### Updates

- Activating a section callout now displays the drawing view aligned with the spatial model.
- Toolbar button to open section location view attachment now works.
- Change SectionLocationProps.clipGeometry type to string. Add get/set ClipVector methods on SectionLocation.

## 1.7.0
Fri, 01 Nov 2019 13:28:37 GMT

### Updates

- Callout clip is now local to placement. Only show marker for active clip.
- Simplify fitView. Hypermodeling plugin cleanup.
- New wip plugin for hypermodeling support.
- Hypermodeling keyins to filter display by type and to ignore category (because MicroStation does).
- Make hypermodeling toolIds more likely to remain unique by including plugin name.
- Added popup toolbar when cursor stops over marker or marker is tapped.

