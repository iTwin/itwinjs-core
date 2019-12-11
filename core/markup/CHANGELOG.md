# Change Log - @bentley/imodeljs-markup

This log was last generated on Tue, 10 Dec 2019 18:08:56 GMT and should not be manually modified.

## 1.9.0
Tue, 10 Dec 2019 18:08:56 GMT

*Version update only*

## 1.8.0
Fri, 22 Nov 2019 14:03:34 GMT

### Updates

- Added missing topic descriptions

## 1.7.0
Fri, 01 Nov 2019 13:28:37 GMT

### Updates

- MarkerSet applies only to a single ScreenViewport

## 1.6.0
Wed, 09 Oct 2019 20:28:42 GMT

### Updates

- #168481 Tool assistance for markup tools
- #165461 #183765 #184303 Fixes for getting image from readMarkup

## 1.5.0
Mon, 30 Sep 2019 22:28:48 GMT

### Updates

- #168481 Added missing iconSpec to measure and clipping tools.
- Correct ViewClipByPlaneTool icon.
- upgrade to TypeScript 3.6.2

## 1.4.0
Tue, 10 Sep 2019 12:09:49 GMT

### Updates

- Fixed prompts for the text and select markup tools.

## 1.3.0
Tue, 13 Aug 2019 20:25:53 GMT

### Updates

- Added icons and fixed prompt issue
- Added icon for redline text tool

## 1.2.0
Wed, 24 Jul 2019 11:47:26 GMT

### Updates

- Add stroke-dasharray to draw lines with dashes in markup

## 1.1.0
Mon, 01 Jul 2019 19:04:29 GMT

### Updates

- (imodeljs-markup merge)
- fix for broken build from svg.js
- Clear flashed element (if it's selected) before deleting or adding to group.
- lock to version 3.0.13 of svg.js package
- Support drag box selection for markup. Support multiselect of markup using touch input.
- Use left/right direction for inside/overlap selection to match element select tool and to support touch move.
- Update to TypeScript 3.5

## 1.0.0
Mon, 03 Jun 2019 18:09:39 GMT

### Updates

- point/vector coverage.
- make MarkupApp.initialize public
- added tests
- Improve touch interaction with markup handles.

## 0.191.0
Mon, 13 May 2019 15:52:05 GMT

### Breaking changes

- publish markup package

### Updates

- Add semver of imodeljs-markup to module/version map
- Fix .npmignore
- Preserve relative z order when grouping markup. Change default arrow direction.
- documentation cleanup
- allow editing of existing markups
- allow editing of boxed text
- Added markup distance measure tool. Fixed groupAll.
- Add beta release tags for markup package.
- Don't use ctrl+f for bring to front shortcut
- Can now sub-class Markup SelectTool, test code to start redline tools from key event moved to display-test-app. Added place markup symbol tool.
- Upgrade TypeDoc dependency to 0.14.2

