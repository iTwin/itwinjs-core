# Change Log - @bentley/frontend-devtools

This log was last generated on Mon, 30 Sep 2019 22:28:48 GMT and should not be manually modified.

## 1.5.0
Mon, 30 Sep 2019 22:28:48 GMT

### Updates

- added support for blank IModelConnections
- Improved configurability of KeyinField.
- DiagnosticsPanel can now be configured to exclude specific components.
- Added tool to get geometry summary
- Added ability to cycle through previously-entered key-ins in KeyinField.
- Add tool to transition between reality and BIM models (demonstrate model animation).
- Added key-in to toggle debugging tooltips.
- #168481 Tool assistance: Measure tools, view clip tools, and touch cursor inputs.
- upgrade to TypeScript 3.6.2
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

