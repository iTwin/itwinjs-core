# Change Log - @bentley/frontend-devtools

This log was last generated on Mon, 24 Aug 2020 18:13:04 GMT and should not be manually modified.

## 2.5.1
Mon, 24 Aug 2020 18:13:04 GMT

### Updates

- Fix model appearance tools to combine with existing overrides correctly.

## 2.5.0
Thu, 20 Aug 2020 20:57:09 GMT

### Updates

- Make certain devtools with decorators cache their decorations.
- Use IModelRoutingContext
- Add tool to set reality model transparency.
- Switch to ESLint

## 2.4.2
Fri, 14 Aug 2020 16:34:09 GMT

*Version update only*

## 2.4.1
Fri, 07 Aug 2020 19:57:43 GMT

*Version update only*

## 2.4.0
Tue, 28 Jul 2020 16:26:24 GMT

### Updates

- Added ability to enable antialiasing
- Add tools for manipulating Map Layers.
- Key-in for toggling whether device pixel ratio is accounted for when computing LOD for tiles and decorations.

## 2.3.3
Thu, 23 Jul 2020 12:57:15 GMT

*Version update only*

## 2.3.2
Tue, 14 Jul 2020 23:50:36 GMT

*Version update only*

## 2.3.1
Mon, 13 Jul 2020 18:50:13 GMT

*Version update only*

## 2.3.0
Fri, 10 Jul 2020 17:23:14 GMT

### Updates

- Add key-ins for saving and applying rendering styles.

## 2.2.1
Tue, 07 Jul 2020 14:44:52 GMT

*Version update only*

## 2.2.0
Fri, 19 Jun 2020 14:10:03 GMT

*Version update only*

## 2.1.0
Thu, 28 May 2020 22:48:59 GMT

### Updates

- Make toggle-type keyins more consistent, accepting ON|OFF|TOGGLE; no argument defaults to TOGGLE.
- Tools for debugging view attachments.
- Track memory for thematic textures in memory panel.

## 2.0.0
Wed, 06 May 2020 13:17:49 GMT

### Updates

- Added key-in to toggle the 'allow 3d manipulations' flag for a 3d view.
- Add keyin 'fdt clip color' to control colorizing of pixels inside or outside clip regions.
- Add tools to save/attach reality models.
- Moved keyin parsing logic to ToolRegistry.
- KeyinField auto-completion supports localized and/or non-localized key-in strings.
- Support display of OrbitGt Point Clouds.
- Add tools for debugging reality tiles.
- Upgrade to Rush 5.23.2
- Add parseArgs() to facilitate keyin argument parsing; add keyins for converting between element Ids and source aspect Ids.
- Remove support for the iModel.js module system by no longer delivering modules.

## 1.14.1
Wed, 22 Apr 2020 19:04:00 GMT

*Version update only*

## 1.14.0
Tue, 31 Mar 2020 15:44:19 GMT

*Version update only*

## 1.13.0
Wed, 04 Mar 2020 16:16:31 GMT

*Version update only*

## 1.12.0
Wed, 12 Feb 2020 17:45:50 GMT

### Updates

- Ignore ReadPixels calls when using GpuProfiler
- Tools for interacting with plan projection models.
- Add tools for operating on plan projection models.
- Added a tool for visualizing tile tree bounding boxes.

## 1.11.0
Wed, 22 Jan 2020 19:24:12 GMT

### Updates

- TileStatisticsTracker now reports number of aborted requests for the session.
- Upgrade to TypeScript 3.7.2.

## 1.10.0
Tue, 07 Jan 2020 19:44:01 GMT

### Updates

- Average the gpu profiler times for the last 120 frames instead of updating each frame; also simplify PerformanceMetrics

## 1.9.0
Tue, 10 Dec 2019 18:08:56 GMT

### Updates

- Add tool for attaching a reality model.
- Added keyins for adjusting tile size modifiers.

## 1.8.0
Fri, 22 Nov 2019 14:03:34 GMT

### Updates

- Key-in for selecting elements by Id; option to include part references in InspectElementTool output.
- Fixed missing exports.
- Stop the keypress and keydown events in the frontend-devtools keyin field from propagating to other elements.
- Inspect element key-in now accepts any number of elemnent Ids as a comma-separated list.
- Key-in for compiling all registered shader programs.
- Added missing topic descriptions
- Remove manipulator and marker test code from project extents debug decoration.

## 1.7.0
Fri, 01 Nov 2019 13:28:37 GMT

### Updates

- Add debug tool for drape frustum
- Update this.keyins when new ones are discovered. Match englishKeyin.
- Fixes for making volume classifiers work.
- Additional options for `emphasize selection` key-in.
- Add ability to record GPU profiling data to Chrome Event Trace Format.
- Key-in for visualizing shadow frustum.
- Visualization of tile requests; key-in to measure time required to load tiles for view.
- Added more types of memory tracking to MemoryTracker.

## 1.6.0
Wed, 09 Oct 2019 20:28:42 GMT

### Updates

- Added key-in to toggle between metric and imperial units formatting.
- Add GPU timing queries for devtools.
- Key-ins for modifying hilite settings.

## 1.5.0
Mon, 30 Sep 2019 22:28:48 GMT

### Updates

- Added support for blank IModelConnections
- Improved configurability of KeyinField.
- DiagnosticsPanel can now be configured to exclude specific components.
- Added tool to get geometry summary
- Added ability to cycle through previously-entered key-ins in KeyinField.
- Add tool to transition between reality and BIM models (demonstrate model animation).
- Added key-in to toggle debugging tooltips.
- Tool assistance: Measure tools, view clip tools, and touch cursor inputs.
- Upgrade to TypeScript 3.6.2
- Fix WindowAreaTool full screen cursor. Added selected view frustum debug tool.

## 1.4.0
Tue, 10 Sep 2019 12:09:49 GMT

### Updates

- Added key-in documentation to README.
- Added keyins for functionality previously exposed by DiagnosticsPanel UI.
- Reduced vertical space consumed by DiagnosticsPanel.
- Added keyins for saving the current view state as JSON and re-applying it later.
- Added keyin for toggling pseudo-wiremesh surface display.
- Prevent TextBox key events propagating to document.

## 1.3.0
Tue, 13 Aug 2019 20:25:53 GMT

### Updates

- Add a frontend keyin UI and handler.
- Key-ins for emphasizing and isolating elements.
- Added keyin for changing view flags.
- Directory organization; package initialization; documentation; new key-ins.

## 1.2.0
Wed, 24 Jul 2019 11:47:26 GMT

### Updates

- Improved dev radiobox
- Added inline option to createTextBox.
- Added the ability to visualize the project extents of an iModel.

## 1.1.0
Mon, 01 Jul 2019 19:04:29 GMT

### Minor changes

- Package created from display-test-app's debug menu and ui widgets.

### Updates

- Added total number of dispatched tile requests and of cache misses to tile statistics tracker.
- Include number of tile trees in memory tracker panel.
- Update to TypeScript 3.5

