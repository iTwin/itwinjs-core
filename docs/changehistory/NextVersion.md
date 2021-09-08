---
publish: false
---
# NextVersion

## White-on-white reversal for non-white backgrounds

White-on-white reversal causes pure white geometry to be displayed as black when drawn onto a pure white background, where it would otherwise be invisible. However, on light-colored (but not pure white) backgrounds, white geometry can be very difficult to discern. [DisplayStyleSettings.whiteOnWhiteReversal]($common) now provides an option to draw white geometry as black regardless of the background color. The following code demonstrates how to enable this behavior for a [DisplayStyleState]($frontend):

```ts
  // Specify that white-on-white reversal should apply regardless of background color.
  displayStyle.settings.whiteOnWhiteReversal = WhiteOnWhiteReversal.fromJSON({ ignoreBackgroundColor: true });
  // Ensure white-on-white reversal is enabled.
  displayStyle.viewFlags = displayStyle.viewFlags.with("whiteOnWhiteReversal", true);
```