# Change Log - @itwin/frontend-tiles

This log was last generated on Wed, 06 Nov 2024 19:24:30 GMT and should not be manually modified.

## 4.9.7
Wed, 06 Nov 2024 19:23:04 GMT

_Version update only_

## 4.9.6
Tue, 05 Nov 2024 15:22:46 GMT

_Version update only_

## 4.9.5
Tue, 22 Oct 2024 20:01:40 GMT

_Version update only_

## 4.9.4
Wed, 09 Oct 2024 20:22:04 GMT

_Version update only_

## 4.9.3
Thu, 03 Oct 2024 19:15:45 GMT

### Updates

- Improve performance by querying for no more than 5 exports.

## 4.9.2
Wed, 02 Oct 2024 15:14:43 GMT

_Version update only_

## 4.9.1
Wed, 25 Sep 2024 20:10:58 GMT

_Version update only_

## 4.9.0
Mon, 23 Sep 2024 13:44:01 GMT

_Version update only_

## 4.8.7
Fri, 13 Sep 2024 15:11:17 GMT

_Version update only_

## 4.8.6
Fri, 06 Sep 2024 05:06:49 GMT

_Version update only_

## 4.8.5
Wed, 28 Aug 2024 17:27:23 GMT

_Version update only_

## 4.8.4
Thu, 22 Aug 2024 17:37:06 GMT

_Version update only_

## 4.8.3
Fri, 16 Aug 2024 18:18:14 GMT

_Version update only_

## 4.8.2
Thu, 15 Aug 2024 15:33:49 GMT

_Version update only_

## 4.8.1
Mon, 12 Aug 2024 14:05:54 GMT

_Version update only_

## 4.8.0
Thu, 08 Aug 2024 16:15:38 GMT

### Updates

- Add iTwinjs version and Tile version tracking to query params
- Fixed planar masks when using new tiles
- Improve resolution of planar clip masks
- Return undefined in getGeoscienceTilesetUrl() if the response is invalid and log error message.
- Add optional Nop fallback to frontend tiles. When a tileset.json is not found or cannot be deserialized we will return an empty Tile Tree instead of using default tiles.

## 4.7.8
Wed, 31 Jul 2024 13:38:04 GMT

_Version update only_

## 4.7.7
Fri, 19 Jul 2024 14:52:42 GMT

_Version update only_

## 4.7.6
Fri, 12 Jul 2024 14:42:55 GMT

_Version update only_

## 4.7.5
Thu, 11 Jul 2024 15:24:55 GMT

### Updates

- Improve resolution of planar clip masks

## 4.7.4
Mon, 01 Jul 2024 14:06:24 GMT

_Version update only_

## 4.7.3
Thu, 27 Jun 2024 21:09:02 GMT

_Version update only_

## 4.7.2
Sat, 22 Jun 2024 01:09:54 GMT

### Updates

- Fixed planar masks when using new tiles

## 4.7.1
Thu, 13 Jun 2024 22:47:32 GMT

_Version update only_

## 4.7.0
Wed, 12 Jun 2024 18:02:16 GMT

### Updates

- Added IndexedDBCache.ts, and added useIndexedDBCache to FrontendTilesOptions
- Add SessionId Header to Mesh Export Service API Call

## 4.6.2
Sat, 08 Jun 2024 00:50:25 GMT

_Version update only_

## 4.6.1
Wed, 29 May 2024 14:35:17 GMT

_Version update only_

## 4.6.0
Mon, 13 May 2024 20:32:51 GMT

_Version update only_

## 4.5.2
Tue, 16 Apr 2024 14:46:22 GMT

_Version update only_

## 4.5.1
Wed, 03 Apr 2024 18:26:59 GMT

_Version update only_

## 4.5.0
Tue, 02 Apr 2024 19:06:00 GMT

### Updates

- Add support for enabling CDN and filtering exports by version
- Clamp the fit volume of a batched tile tree to the project extents.

## 4.4.9
Mon, 15 Apr 2024 20:29:22 GMT

_Version update only_

## 4.4.8
Mon, 25 Mar 2024 22:22:26 GMT

_Version update only_

## 4.4.7
Fri, 15 Mar 2024 19:15:14 GMT

_Version update only_

## 4.4.6
Fri, 08 Mar 2024 15:57:12 GMT

### Updates

- Clamp the fit volume of a batched tile tree to the project extents.

## 4.4.5
Tue, 05 Mar 2024 20:37:18 GMT

_Version update only_

## 4.4.4
Fri, 01 Mar 2024 18:21:01 GMT

_Version update only_

## 4.4.3
Fri, 23 Feb 2024 21:26:07 GMT

### Updates

- Add support for enabling CDN and filtering exports by version

## 4.4.2
Fri, 16 Feb 2024 14:22:01 GMT

_Version update only_

## 4.4.1
Fri, 16 Feb 2024 14:17:48 GMT

_Version update only_

## 4.4.0
Mon, 12 Feb 2024 18:15:58 GMT

### Updates

- Add support for a transform on leaf tiles.
- Support nested tile transforms.
- Add support for per-model display settings including plan projections, display transforms, view flag overrides, and model clip groups.
- Fix attached reality models not displaying with batched tiles.
- Fix failure to display private, template, or reality models.

## 4.3.5
Mon, 25 Mar 2024 16:54:37 GMT

_Version update only_

## 4.3.4
Fri, 22 Mar 2024 13:30:31 GMT

_Version update only_

## 4.3.3
Wed, 03 Jan 2024 19:28:38 GMT

_Version update only_

## 4.3.2
Thu, 14 Dec 2023 20:23:02 GMT

_Version update only_

## 4.3.1
Wed, 13 Dec 2023 17:25:55 GMT

_Version update only_

## 4.3.0
Thu, 07 Dec 2023 17:43:09 GMT

### Updates

- Add support for a transform on leaf tiles.
- Support nested tile transforms.
- Fix attached reality models not displaying with batched tiles.

## 4.2.4
Mon, 20 Nov 2023 16:14:45 GMT

_Version update only_

## 4.2.3
Mon, 06 Nov 2023 14:01:52 GMT

_Version update only_

## 4.2.2
Thu, 02 Nov 2023 15:36:21 GMT

_Version update only_

## 4.2.1
Tue, 24 Oct 2023 15:09:13 GMT

_Version update only_

## 4.2.0
Tue, 17 Oct 2023 15:14:32 GMT

### Updates

- Permit visible edges and wireframe mode to be used with batched tiles.

## 4.1.9
Tue, 10 Oct 2023 18:48:12 GMT

_Version update only_

## 4.1.8
Fri, 06 Oct 2023 04:00:18 GMT

_Version update only_

## 4.1.7
Thu, 28 Sep 2023 21:41:33 GMT

_Version update only_

## 4.1.6
Tue, 12 Sep 2023 15:38:52 GMT

_Version update only_

## 4.1.5
Fri, 08 Sep 2023 13:37:23 GMT

_Version update only_

## 4.1.4
Thu, 07 Sep 2023 18:26:02 GMT

_Version update only_

## 4.1.3
Wed, 30 Aug 2023 15:35:27 GMT

_Version update only_

## 4.1.2
Wed, 23 Aug 2023 15:25:29 GMT

_Version update only_

## 4.1.1
Fri, 18 Aug 2023 13:02:53 GMT

_Version update only_

## 4.1.0
Mon, 14 Aug 2023 14:36:34 GMT

### Updates

- Decode tiles in a web worker.
- Switch to ESLint new flat config system

## 4.0.7
Thu, 10 Aug 2023 13:19:24 GMT

_Version update only_

## 4.0.6
Mon, 24 Jul 2023 05:07:33 GMT

_Version update only_

## 4.0.5
Tue, 18 Jul 2023 12:21:56 GMT

_Version update only_

## 4.0.4
Wed, 12 Jul 2023 15:50:01 GMT

_Version update only_

## 4.0.3
Mon, 03 Jul 2023 15:28:41 GMT

### Updates

- Promote APIs to beta.
- Provide functions for obtaining URLs from mesh export service.

## 4.0.2
Wed, 21 Jun 2023 22:04:43 GMT

_Version update only_

## 4.0.1
Wed, 21 Jun 2023 20:29:14 GMT

_Version update only_

## 4.0.0
Mon, 22 May 2023 15:34:14 GMT

### Updates

- Update to eslint@8
- Add support for schedule animations.
- Remove y-up-to-z-up display transform.
- Ensure fitting the view fits to the extents of the currently-viewed models.
- Add new experimental package providing alternate technique for visualizing iModels.

## 3.8.0
Fri, 08 Dec 2023 15:23:59 GMT

_Version update only_

## 3.7.17
Mon, 20 Nov 2023 18:24:23 GMT

_Version update only_

## 3.7.16
Mon, 16 Oct 2023 12:49:08 GMT

_Version update only_

## 3.7.15
Tue, 10 Oct 2023 19:58:35 GMT

_Version update only_

## 3.7.14
Fri, 29 Sep 2023 16:57:16 GMT

_Version update only_

## 3.7.13
Tue, 08 Aug 2023 19:49:18 GMT

_Version update only_

## 3.7.12
Thu, 27 Jul 2023 21:50:57 GMT

_Version update only_

## 3.7.11
Tue, 11 Jul 2023 17:17:22 GMT

_Version update only_

## 3.7.10
Wed, 05 Jul 2023 13:41:21 GMT

_Version update only_

## 3.7.9
Tue, 20 Jun 2023 12:51:02 GMT

_Version update only_

## 3.7.8
Thu, 01 Jun 2023 17:00:39 GMT

_Version update only_

## 3.7.7
Wed, 24 May 2023 17:27:09 GMT

_Version update only_

## 3.7.6
Mon, 15 May 2023 18:23:41 GMT

_Version update only_

## 3.7.5
Thu, 04 May 2023 19:43:18 GMT

_Version update only_

## 3.7.4
Tue, 25 Apr 2023 17:50:35 GMT

### Updates

- Improve tile content disposal under memory pressure.

## 3.7.3
Thu, 20 Apr 2023 13:19:29 GMT

_Version update only_

## 3.7.2
Wed, 12 Apr 2023 13:12:42 GMT

_Version update only_

## 3.7.1
Mon, 03 Apr 2023 15:15:37 GMT

_Version update only_

## 3.7.0
Wed, 29 Mar 2023 15:02:27 GMT

### Updates

- Remove y-up-to-z-up display transform.
- Ensure fitting the view fits to the extents of the currently-viewed models.
- Add new experimental package providing alternate technique for visualizing iModels.

