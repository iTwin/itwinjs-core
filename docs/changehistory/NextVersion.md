---
publish: false
---

# NextVersion

Table of contents:

- [Electron 36 and 37 support](#electron-36-and-37-support)
- [Google Photorealistic 3D Tiles support](#google-photorealistic-3d-tiles-support)
- [Text changes and styling](#text-changes-and-styling)
- [API deprecations](#api-deprecations)
  - [@itwin/presentation-common](#itwinpresentation-common)
  - [@itwin/presentation-backend](#itwinpresentation-backend)
  - [@itwin/presentation-frontend](#itwinpresentation-frontend)

## Electron 36 and 37 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 36](https://www.electronjs.org/blog/electron-36-0) and [Electron 37](https://www.electronjs.org/blog/electron-37-0).

## Google Photorealistic 3D Tiles support

iTwin.js now supports displaying Google Photorealistic 3D Tiles via the new `Google3dTilesProvider`. See [this article](../learning/frontend/GooglePhotorealistic3dTiles.md) for more details.

![Google Photorealistic 3D Tiles - Exton](../learning/frontend/google-photorealistic-3d-tiles-1.jpg "Google Photorealistic 3D Tiles - Exton")

![Google Photorealistic 3D Tiles - Philadelphia](../learning/frontend/google-photorealistic-3d-tiles-2.jpg "Google Photorealistic 3D Tiles - Philadelphia")

## Text changes and styling

### Persisting text

[TextAnnotation2d]($backend) and [TextAnnotation3d]($backend) now use the new BIS property `textAnnotationData` to persist the [TextAnnotation]($common) instead of storing it in the `jsonProperties`. You should still use `setAnnotation` and `getAnnotation` to interact with the persisted [TextAnnotation]($common).

### Drawing scale

Producing geometry for a [TextAnnotation]($common) inside of a [Drawing]($backend) now automatically scales the text by the `Drawing.scaleFactor`.

### Styling text

[AnnotationTextStyle]($backend) is a new class enabling [TextStyleSettings]($common) to be persisted in the iModel. It replaces the TextStyle class which is now removed.

[TextBlock]($common)s, [Paragraph]($common)s, and [Run]($common)s no longer refer to a persisted style by name. Instead, [TextBlock]($common)s refer to an [AnnotationTextStyle]($backend) by ID. [Paragraph]($common)s and [Run]($common)s can only provide style overrides.

[TextFrameStyleProps]($common) and [TextLeaderStyleProps]($common) are now part of [TextStyleSettings]($common)s. [TextAnnotationLeader]($common)s can only specify style overrides.

Text styling is now inherited by child [TextBlockComponent]($common)s. That means each style property overridden or inherited by the parent is also applied to the child, unless the child explicitly provides its own override for that property. [TextAnnotationLeader]($common)s are a special case. They are children of [TextAnnotation]($common)s. So are [TextBlock]($common)s. Leaders inherit their default styling from the [AnnotationTextStyle]($backend) specified by their sibling [TextBlock]($common). Use the [TextStyleResolver]($backend) class to resolve the effective style of TextBlockComponents and Leaders, taking into account overrides/style of the instance and its parent(s)/sibling.

## API deprecations

### @itwin/presentation-common

- `UnitSystemFormat`, `FormatsMap` and `KoqPropertyValueFormatter` constructor using the latter type have been deprecated. Instead, the constructor overload with "props" object should be used. The props object allows passing an optional `FormatsProvider` to use for finding formatting props for different types of values. When not specified, the `SchemaFormatsProvider` is used by default, so the behavior stays the same as before. Ideally, it's expected that frontend apps will pass `IModelApp.formatsProvider` for this prop.

### @itwin/presentation-backend

- The `PresentationManagerProps.schemaContextProvider` property has been deprecated. Starting with `5.0` release, `SchemaContext` is always available on [IModelDb]($core-backend), so this prop is no longer needed. If supplied, it will still be preferred over the iModel's schema context, until the property is removed completely in a future release.
- The `PresentationManagerProps.defaultFormats` property has been deprecated in favor of the new `formatsProvider` property.

### @itwin/presentation-frontend

- The `PresentationManagerProps.schemaContextProvider` property has been deprecated. Starting with `5.0` release, `SchemaContext` is always available on [IModelConnection]($core-frontend), so this prop is no longer needed. If supplied, it will still be preferred over the iModel's schema context, until the property is removed completely in a future release.
- The `PresentationManagerProps.defaultFormats` property has been deprecated in favor of the `FormatsProvider` now being available on [IModelApp.formatsProvider]($core-frontend).

## Schedule Script Editing Mode

[DisplayStyle3dState]($frontend) now offers an interactive editing mode for [RenderSchedule.Script]($common)s, allowing interactive, dynamic modification of the style's schedule script with immediate visual feedback. Previously, every modification of the script would trigger a refresh of all of the graphics; the new mode instead draws temporary graphics just for the elements affected by the script changes.

Use [DisplayStyle3dState.setScheduleEditing]($frontend) to enter this mode, or to update the script again after entering the mode. Once all edits are complete, call [DisplayStyle3dState.commitScheduleEditing]($frontend) to finalize the changes a trigger a full refresh of the graphics. Example:

```ts
[[include:ScheduleScript_editingMode]]
```