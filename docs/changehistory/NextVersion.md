---
publish: false
---
# NextVersion

## Cached decorations

A [Decorator]($frontend)'s `decorate` method is invoked to create new [Decorations]($frontend) whenever a viewport's decorations are invalidated. Decorations are invalidated quite frequently - for example, every time the view frustum or scene changes, and even on every mouse motion. Most decorators' decorations only actually change when the scene changes. Having to regenerate them every time the mouse moves is quite wasteful and - for all but the most trivial decorations - can negatively impact framerate. Here's an example of a decorator that draws some complicated shape in a specified color:

```ts
class FancyDecorator {
  private _color: ColorDef; // the color of our shape decoration

  public set color(color: ColorDef): void {
    this._color = color;

    // Make sure our decorate method is called so we draw using the new color.
    // This also invalidates every other decorator's decorations!
    IModelApp.viewManager.invalidateDecorationsAllViews();
  }

  public decorate(context: DecorateContext): void {
    // ...draw a fancy shape using this._color
    // This gets called every single time the mouse moves,
    // and any other time the viewport's decorations become invalidated!
  }
}
```

We can avoid unnecessarily recreating decorations by defining the `useCachedDecorations` property. If this is `true`, then whenever the viewport's decorations are invalidated, the viewport will first check to see if it already has cached decorations for this decorator. If so, it will simply reuse them; if not, it will invoke `decorate` and cache the result. When the scene changes, our cached decorations will automatically be discarded. Here's the decorator from above, updated to use cached decorations:

```ts
class FancyDecorator {
  private _color: ColorDef; // the color of our shape decoration

  // Tell the viewport to cache our decorations.
  // We'll tell it when to regenerate them.
  public readonly useCachedDecorations = true;

  public set color(color: ColorDef): void {
    this._color = color;

    // Invalidate *only* this decorator's decorations.
    IModelApp.viewManager.invalidateCachedDecorationsAllViews(this);
  }

  public decorate(context: DecorateContext): void {
    // ...draw a fancy shape using this._color
    // This *only* gets called if the scene changed,
    // or if explicitly asked for our decorations to be regenerated.
  }
}
```

[ViewManager.invalidateCachedDecorationsAllViews]($frontend) (and [Viewport.invalidateCachedDecorations]($frontend)) give the decorator much tighter control over when its decorations are regenerated, potentially resulting in significantly improved performance.

## FeatureSymbology namespace

Types related to overriding feature symbology - previously defined in `imodeljs-frontend`'s [FeatureSymbology]($frontend) namespace - are now also available in the `imodeljs-common` package.

- [FeatureSymbology.Appearance]($frontend) and [FeatureSymbology.AppearanceProps]($frontend) are now deprecated in favor of [FeatureAppearance]($common) and [FeatureAppearanceProps]($common).
- [FeatureAppearanceProvider]($common) replaces the `beta` `FeatureSymbology.AppearanceProvider` interface.
- [FeatureOverrides]($common) now serves as a base class for [FeatureSymbology.Overrides]($frontend). Only the latter can be constructed from a [Viewport]($frontend) or [ViewState]($frontend).

## ui-components

Breaking change to the `beta` interface [ColorPickerProps]($ui-components). The `activeColor` property has been renamed to `initialColor`. The modified props are used by the   [ColorPickerButton]($ui-components) React component.
