# AccuDraw User Interface

[AccuDrawViewportUI]($frontend) is provided as an in viewport user interface for AccuDraw that is implemented using HTMLElement. It is currently @beta while gathering feedback.

Applications can choose between a vertical or horizontal layout as well as whether the controls follow the cursor or display at a fixed location at the bottom middle of the view.

> Example showing vertical layout that follows the cursor.

![accudraw vertical cursor](./accudraw-vertical-cursor.png "Vertical layout that follows the cursor")

> Example showing horizontal layout with a fixed location.

![accudraw horizontal fixed](./accudraw-horizontal-fixed.png "Horizontal layout with fixed location")

- [AccuDraw User Interface](#accudraw-user-interface)
  - [Using AccuDraw](#using-accudraw)
    - [Explaining Focus](#explaining-focus)
    - [Moving Focus](#moving-focus)
    - [Entering Values](#entering-values)
    - [AccuDraw and Nearest Snap](#accudraw-and-nearest-snap)
  - [Application Support](#application-support)
    - [Setup](#setup)
    - [Configuration](#configuration)
    - [Keyboard Shortcuts](#keyboard-shortcuts)

> *NOTE: When referencing shortcuts a description will be used, ex. *set origin*, as specific keys and availability is application dependent.*

## Using AccuDraw

AccuDraw supports two modes for coordinate input, polar and rectangular. The current mode can be switched using the *change mode* shortcut.

> Polar Mode:

![accudraw polar](./accudraw-polar.png "Polar Mode")

1. Distance input field is the distance from the compass origin.
2. Angle input field can be either an angle or bearing direction.
   - Angle - rotation around compass Z axis measured from compass X axis.
   - Bearing Direction - setting controls whether relative to compass or design axes.
3. Z input field is delta distance from compass origin in Z axis direction (3d only).

> Rectangular Mode:

![accudraw rectangular](./accudraw-rectangular.png "Rectangular Mode")

1. X input field is delta distance from compass origin in X axis direction.
2. Y input field is delta distance from compass origin in Y axis direction.
3. Z input field is delta distance from compass origin in Z axis direction (3d only).

### Explaining Focus

In order to effectively use AccuDraw it is important to first understand input focus and the visual clues that are used to communicate what currently has focus.

> Example showing focus on AccuDraw.

![accudraw input focus](./accudraw-focus-accudraw.png "Showing focus on AccuDraw")

1. Distance field currently has input focus. New input will replace the current value and lock the field when not already locked.
2. AccuDraw compass displays in color when any input field has focus.

> Example showing focus on Home.

![accudraw home focus](./accudraw-focus-home.png "Showing focus on home")

1. New input can not be entering as no field currently has focus.
2. AccuDraw compass still displays in color when focus is at home to indicate that keyboard shortcuts can be used. Using an AccuDraw shortcut, ex. *set origin*, also moves focus to the last active or default input field.

> Example showing focus on tool settings.

![accudraw home other](./accudraw-focus-other.png "Showing focus on tool settings")

1. New input can not be entering as no field currently has focus.
2. AccuDraw compass displays in monochrome to indicate that focus is not on AccuDraw or Home and keyboard shortcuts can NOT be used. AccuDraw can be given focus by using a [TentativePoint]($frontend) (middle mouse button click) or by moving focus to Home and using a keyboard shortcut.

### Moving Focus

Escape moves focus to home
Tab/shift+tab, up arrow, down arrow

### Entering Values

Special keys:

home, end, insert, delete, backspace, left arrow, right arrow.
page up/shift+up arrow - choose previous value
page down/shift+down arrow - choose next value
enter - accept current value, don't move focus

Letters treated as potential shortcut. Exception NSEW when angle field and bearing direction.

### AccuDraw and Nearest Snap

You can combine AccuDraw's distance and axis locks with [SnapMode.Nearest]($frontend) to adjust the current point to the intersection with the snapped geometry.

![accudraw nearest axis lock](./accudraw-nearest-axis.png "Example showing keypoint vs. nearest snap with axis lock")

1. Keypoint snap projects the closest keypoint on the snapped geometry to the locked axis
2. Nearest snap finds the intersection of the locked axis and the snapped geometry

![accudraw nearest distance lock](./accudraw-nearest-distance.png "Example showing keypoint vs. nearest snap with distance lock")

1. Keypoint snap sets the current point at the locked distance along the vector from the compass origin to closest keypoint.
2. Nearest snap finds the intersection between the circle defined by the locked distance and the snapped geometry.

## Application Support

### Setup

Setting IModelAppOptions.accuDraw...

### Configuration

Setting UI options, follow cursor, or fixed horizontal, etc.

### Keyboard Shortcuts

ToolAdmin.processShortcutKey

appui caveat...
