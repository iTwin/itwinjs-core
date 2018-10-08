# Change Log - @bentley/imodeljs-common

This log was last generated on Fri, 05 Oct 2018 21:52:26 GMT and should not be manually modified.

## 0.152.0
Fri, 05 Oct 2018 21:52:26 GMT

### Updates

- Change ColorDef to ColorDefProps in GeometryStream wire format interfaces.
- IModelError now requires the message parameter
- RpcInterface docs
- more docs

## 0.151.0
Thu, 04 Oct 2018 21:10:57 GMT

*Version update only*

## 0.150.0
Thu, 04 Oct 2018 21:06:01 GMT

### Updates

- Add RPC Changes
- Add README.md
- RpcInterfaceStatus
- RpcInterface docs
- docs
- Updating copyrights

## 0.146.0
Tue, 02 Oct 2018 14:51:50 GMT

*Version update only*

## 0.145.0
Tue, 02 Oct 2018 01:02:27 GMT

*Version update only*

## 0.144.0
Mon, 01 Oct 2018 22:10:58 GMT

*Version update only*

## 0.143.0
Mon, 01 Oct 2018 19:10:45 GMT

### Updates

- Changed some iModelHub types to be stricter

## 0.142.0
Mon, 01 Oct 2018 10:28:46 GMT

*Version update only*

## 0.141.0
Fri, 28 Sep 2018 22:27:44 GMT

### Updates

- Support snapping to pickable decorations. Allow snap to ACS origin.
- InteractiveTool methods to support snappable decorations. Restore AccuDraw/Tentative/Reset interaction.
- 0.140.0

## 0.140.0
Fri, 28 Sep 2018 21:04:21 GMT

### Updates

- Version 0.139.0
- Removed more assertions when opening an iModel with no change sets. 

## 0.139.0
Fri, 28 Sep 2018 19:37:10 GMT

*Version update only*

## 0.138.0
Fri, 28 Sep 2018 17:15:55 GMT

### Updates

- Remove redundant Id64Props type - replace usage with equivalent but more descriptive Id64String.

## 0.137.0
Fri, 28 Sep 2018 00:57:48 GMT

### Updates

- doc fixes

## 0.136.0
Thu, 27 Sep 2018 15:02:44 GMT

### Updates

- Check for subcategory appearance invisible and dontSnap.

## 0.135.0
Wed, 26 Sep 2018 19:16:30 GMT

*Version update only*

## 0.134.0
Wed, 26 Sep 2018 00:50:11 GMT

### Updates

- Support for intersect snap.
- Simplify IntersectDetail, just second CurvePrimitive and sourceId.
- ElementAspectProps.element is now of type RelatedElementProps

## 0.133.0
Tue, 25 Sep 2018 16:41:00 GMT

*Version update only*

## 0.132.0
Mon, 24 Sep 2018 18:55:46 GMT

### Updates

- Support center snap as part of multi-snap when interiors aren't pickable (open path or wireframe view)
- documentation
- Renamed X-CorrelationId to X-Correlation-Id in HTTP headers to comply with standards. 

## 0.131.0
Sun, 23 Sep 2018 17:07:30 GMT

*Version update only*

## 0.130.0
Sun, 23 Sep 2018 01:19:16 GMT

*Version update only*

## 0.129.0
Fri, 21 Sep 2018 23:16:13 GMT

### Updates

- Add initial support for the Generic domain.
- ElementAspectProps now inherits "id" from EntityProps
- Get rid of RpcInvocation.current.context - use ActivityLoggingContext.current instead

## 0.128.0
Fri, 14 Sep 2018 17:08:05 GMT

*Version update only*

## 0.127.0
Thu, 13 Sep 2018 17:07:11 GMT

### Updates

- added ColorDef.invert

## 0.126.0
Wed, 12 Sep 2018 19:12:10 GMT

*Version update only*

## 0.125.0
Wed, 12 Sep 2018 13:35:50 GMT

*Version update only*

## 0.124.0
Tue, 11 Sep 2018 13:52:59 GMT

### Updates

- Add initial support for the Functional domain.

## 0.123.0
Wed, 05 Sep 2018 17:14:50 GMT

*Version update only*

## 0.122.0
Tue, 28 Aug 2018 12:25:19 GMT

*Version update only*

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

*Version update only*

## 0.112.0
Tue, 07 Aug 2018 12:19:22 GMT

*Version update only*

## 0.111.0
Mon, 06 Aug 2018 19:25:38 GMT

*Version update only*

## 0.110.0
Thu, 02 Aug 2018 14:48:42 GMT

*Version update only*

## 0.109.0
Thu, 02 Aug 2018 09:07:03 GMT

*Version update only*

## 0.108.0
Wed, 01 Aug 2018 14:24:06 GMT

### Updates

- Updated to use TypeScript 2.9

## 0.107.0
Tue, 31 Jul 2018 16:29:14 GMT

*Version update only*

## 0.106.0
Tue, 31 Jul 2018 13:01:51 GMT

*Version update only*

## 0.105.0
Tue, 31 Jul 2018 11:36:14 GMT

### Updates

- Frustum fromRange bug
- Added support for transfering binary resources to RPC layer.

## 0.104.1
Thu, 26 Jul 2018 21:35:07 GMT

*Version update only*

## 0.104.0
Thu, 26 Jul 2018 18:25:15 GMT

### Updates

- SheetProps contains attachment ids for SheetViewState

## 0.103.0
Tue, 24 Jul 2018 15:52:30 GMT

*Version update only*

## 0.102.0
Tue, 24 Jul 2018 14:13:01 GMT

### Updates

- added tooltips
- Make fit tool ignore web mercator tile range.
- remove get/setShow methods on ViewFlags. They were redundant.

## 0.101.0
Mon, 23 Jul 2018 22:00:01 GMT

### Updates

- Moved EntityMetaData from backend to common

