# Style

The `@itwin/core-react` package includes Sass variables and mixins for
colors and themes,
breakpoints,
opacity,
sizing,
spacing
and typography.

## Colors and Themes

There are two color themes delivered in `@itwin/core-react`: 'light' and 'dark'.
The color values for each theme are defined in `core-react/style/colorthemes.scss`.
This file is imported in `@itwin/core-react` by UiCore.ts and that should be the only place where it is imported.
(It should **not** be imported by any \*.scss or other core-react files.)

The color theme system uses CSS variables (aka. CSS custom properties) to define the color values. The values of the CSS variables are changed when the name of the "data-theme" document element attribute is set.
The `ThemeManager` component in the `@itwin/appui-react` package does this by calling `document.documentElement.setAttribute("data-theme", theme)`.

Sass variables are used in the UI components to reference the CSS variables set to the themed colors.
These themed color Sass variables are defined in the
`core-react/style/themecolors.scss` file and begin with `$buic-`. These should be used when styling a themed component.
There are older Sass variables that begin with `$uicore-`. These should **not** be used when styling a themed component.
Examples of these variables include `$uicore-text-color`, `$uicore-green` and `$uicore-blue`.

### Basic Themed Colors

The following Sass variables define the basic background and foreground themed colors:

| Themed Color Variable         | Description & Uses                                             |
| ----------------------------- | -------------------------------------------------------------- |
| $buic-background-1            | Lightest background - control/component backgrounds            |
| $buic-background-2            | Active tab, dialog/window background                           |
| $buic-background-3            | Inactive tab/button, context menu, panel, tree placeholder     |
| $buic-background-4            | Out of focus title bar, divider, status bar, table header      |
| $buic-background-5            | Darkest background - Title bar, strokes/borders                |
| $buic-background-scrollbar    | Scrollbar background                                           |
| $buic-background-editable     | Indicates when a cell is focused & editable                    |
| $buic-row-selection           | Indicates when a cell is selected                              |
| $buic-row-hover               | Indicates when the mouse is hovering over a cell               |
| $buic-foreground-body         | Basic foreground color for text and icons. Opacity is 0.85.    |
| $buic-foreground-body-reverse | Black/white reverse color from the $buic-foreground-body color |
| $buic-foreground-disabled     | Foreground color with 0.45 opacity                             |
| $buic-foreground-muted        | Foreground color with 0.65 opacity                             |
| $buic-foreground-activehover  | Foreground color with 1.0 opacity                              |
| $buic-foreground-accessory    | Defined as white for both themes                               |
| $buic-foreground-primary      | Themed Blue color                                              |
| $buic-foreground-primary-tone | Slightly darker than primary, used for primary hover           |
| $buic-foreground-primary-tint | Slightly lighter than -primary                                 |
| $buic-foreground-success      | Themed Green color                                             |
| $buic-foreground-success-tint | Slightly lighter than -success                                 |
| $buic-foreground-alert        | Themed Red color                                               |
| $buic-foreground-alert-tint   | Slightly lighter than -alert                                   |
| $buic-foreground-warning      | Themed Orange color                                            |
| $buic-foreground-warning-tint | Slightly lighter than -warning                                 |

There are additional Sass variables defined in
`core-react/style/themecolors.scss` for different contexts.
For instance, the `$buic-text-color` and `$buic-icon-color` variables are assigned to `$buic-foreground-body`.
`$buic-background-control` is assigned to `$buic-background-1`.
`$buic-background-control-stroke` is assigned to `$buic-background-5`.

Since there are variables defined for the different background contexts, they should be used within those contexts, and the
`$buic-background-1` through `$buic-background-5` variables should rarely be used directly.

```scss
@import "~@itwin/core-react/lib/cjs/core-react/style/themecolors";

.my-component {
  color: $buic-text-color;
  background-color: $buic-background-control;
}
```

## Breakpoints

Several breakpoints are defined for dealing with screens and devices with different heights and widths. Internally, these breakpoints use CSS @media queries.

| Breakpoint Name           | Size Check        |
| ------------------------- | ----------------- |
| for-phone-only            | max-width: 599px  |
| for-tablet-portrait-up    | min-width: 600px  |
| for-tablet-portrait-down  | max-width: 799px  |
| for-tablet-landscape-up   | min-width: 800px  |
| for-tablet-landscape-down | max-width: 1099px |
| for-desktop-up            | min-width: 1100px |
| for-small-desktop-down    | max-width: 1299px |
| for-medium-desktop-up     | min-width: 1300px |
| for-big-desktop-up        | min-width: 1800px |

### Example

```scss
@import "~@itwin/core-react/lib/cjs/core-react/style/breakpoints";

.toolAssistance-separator {
  @include for-tablet-landscape-down {
    display: none;
  }
}
```

## Opacity

Different opacity stops are defined in the `core-react/style/opacity.scss` file.

| Opacity Variable         | Opacity Level |
| ------------------------ | ------------- |
| $uicore-opacity-1        | 1.0           |
| $uicore-opacity-2        | 0.85          |
| $uicore-opacity-3        | 0.65          |
| $uicore-opacity-muted    | 0.65          |
| $uicore-opacity-4        | 0.45          |
| $uicore-opacity-disabled | 0.45          |
| $uicore-opacity-5        | 0.25;         |
| $uicore-opacity-6        | 0.1;          |

## Spacing

Different spacing values are defined in the `core-react/style/space.scss` file.

| Space Variable | Space Amount |
| -------------- | ------------ |
| $uicore-xxs    | 2px          |
| $uicore-xs     | 4px          |
| $uicore-s      | 8px          |
| $uicore-sm     | 12px         |
| $uicore-m      | 16px         |
| $uicore-l      | 24px         |
| $uicore-xl     | 32px         |
| $uicore-xxl    | 64px         |
| $uicore-3xl    | 96px         |

## Typography

Different font sizes, weights and families are defined in the `core-react/style/typography.scss` file.

| Font Size Variable           | Font Size Amount |
| ---------------------------- | ---------------- |
| $uicore-font-size            | 14px             |
| $uicore-font-size-small      | 12px             |
| $uicore-font-size-smaller    | 11px             |
| $uicore-font-size-leading    | 16px             |
| $uicore-font-size-subheading | 18px             |
| $uicore-font-size-title      | 24px             |
| $uicore-font-size-headline   | 32px             |

| Font Weight Variable         | Font Weight Amount |
| ---------------------------- | ------------------ |
| $uicore-font-weight-light    | 300                |
| $uicore-font-weight-normal   | 400                |
| $uicore-font-weight-semibold | 600                |
| $uicore-font-weight-bold     | 700                |

The `core-react/text/index.scss` file also brings in several mixins that assist with styling text. The `uicore-text` mixin takes a text type name and defines font size, weight & line height.

| Text Type    | Description    |
| ------------ | -------------- |
| headline     | 32px, light    |
| title        | 24px, light    |
| title-2      | 24px, normal   |
| subheading   | 18px, normal   |
| subheading-2 | 18px, semibold |
| leading      | 16px, normal   |
| leading-2    | 16px, bold     |
| body         | 14px, normal   |
| small        | 12px, normal   |
| caption      | 12px, normal   |

There are also specific mixins for the text types.

| Mixin Name               | Description                               |
| ------------------------ | ----------------------------------------- |
| uicore-text-block        | body text with block spacing              |
| uicore-text-body         | body text                                 |
| uicore-text-disabled     | sets color to `$buic-foreground-disabled` |
| uicore-text-headline     | headline text with block spacing          |
| uicore-text-leading      | leading text with block spacing           |
| uicore-text-leading-2    | leading-2 text with block spacing         |
| uicore-text-muted        | sets color to `$buic-foreground-muted`    |
| uicore-text-small        | small text with 0 for padding and margin  |
| uicore-text-subheading   | subheading text with block spacing        |
| uicore-text-subheading-2 | subheading-2 text with block spacing      |
| uicore-text-title        | title text with block spacing             |
| uicore-text-title-2      | title-2 text with block spacing           |

There are also React components for the different text types. E.g.

```tsx
import { BodyText, LeadingText, SmallText } from "@itwin/core-react";

  <LeadingText>Dialog Title</LeadingText>
  <BodyText>Normal message text</BodyText>
  <SmallText>Detailed message explanation</SmallText>
```

**Note**: Contrary to the variable name, the `leading` text is normally used for title bar text.

## Scrollbar

A couple of Sass mixins are provided for standardizing the look of a scrollbar.
`uicore-touch-scrolling` provides smooth scrolling on touch devices.
`uicore-scrollbar` defines a standard scrollbar look in Chrome/Webkit based browsers.
For any container CSS class that shows a scrollbar, the `uicore-touch-scrolling` and `uicore-scrollbar` mixins should be included.

### Example

```scss
@import "~@itwin/core-react/lib/cjs/core-react/scrollbar";

.my-scrollable-container {
  @include uicore-touch-scrolling;
  @include uicore-scrollbar();
}
```

## Standard z-index Values

The `uicore-z-index` mixin sets a standard z-index for CSS classes.
The following Ids can be passed to the `uicore-z-index` mixin and are
listed in order from lowest to top-most:

- view-overlay
- widget-grip
- dragged-widget
- zone-target
- zone-outline
- toolbar-panels
- tool-settings-popup
- status-popup
- status-message
- modal-frontstage-overlay
- modal-frontstage
- dialog
- dialog-popup
- tooltip
- context-menu-z
- dragdrop
- cursor-overlay
- drag-target
- drag-preview
- backstage-overlay
- backstage

### Example

```scss
@import "~@itwin/core-react/lib/cjs/core-react/z-index";

.my-tooltip {
  @include uicore-z-index(tooltip);
}
```
