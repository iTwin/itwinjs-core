# Base

The [Base]($core-react:Base) category in the `@itwin/core-react` package includes low-level classes and components for building a user interface.

## Div

The [Div]($core-react) component is a base `<div>` HTML element wrapper.

The mandatory `mainClassName` prop is used as the first value for the `className` prop for the `<div>`.
The optional `className` prop is used as the second value for the `className`.
The optional `style` prop can also provide CSS properties for the `<div>`.

### Example

A React component that uses the Div component accepts props with the type of [CommonDivProps]($core-react). `CommonDivProps` contains all HTML attributes appropriate for a `<div>` element. The `mainClassName` prop sets the main CSS class to use.

```tsx
import * as React from "react";
import { CommonDivProps, Div } from "@itwin/core-react";

export function MyComponent(props: CommonDivProps) {
  return <Div {...props} mainClassName="my-css-class" />;
}
```

## DivWithOutsideClick

The [DivWithOutsideClick]($core-react) component is a `<div>` HTML element with Outside Click behavior, which is provided by the [withOnOutsideClick]($core-react) HOC.

## Centered

[Centered]($core-react) displays content centered vertically and horizontally.
It uses the `uicore-centered` CSS class.

## FillCentered

[FillCentered]($core-react) displays content centered vertically and horizontally and has a height and width of 100%.
It uses the `uicore-fill-centered` CSS class.

## FlexWrapContainer

[FlexWrapContainer]($core-react) wraps content onto multiple lines and has the 'display: flex' and 'flex-wrap: wrap' CSS properties.
It uses the `uicore-flex-wrap-container` CSS class.

## ScrollView

[ScrollView]($core-react) scrolls content vertically. It has the 'overflow-y: auto' CSS property and has a height and width of 100%.
It uses the `uicore-scrollview` CSS class.

## API Reference

- [Base]($core-react:Base)
