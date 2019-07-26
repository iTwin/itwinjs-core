# Change Log - @bentley/imodeljs-markup

This log was last generated on Wed, 24 Jul 2019 11:47:26 GMT and should not be manually modified.

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

