# Utilities

The [Utilities]($ui-core:Inputs) category in the `@bentley/ui-core` package includes
various utility classes, functions and React hooks for working with a UI.

- [ClassNameProps]($ui-core) - Props used by components that expect a CSS class name to be passed in
- [CommonProps]($ui-core) - Common props used by components; includes `style` for CSS properties
- [CommonDivProps]($ui-core) - Common properties using a `<div>` element
- [IconHelper]($ui-core) - Icon Helper Class used to store the data needed to generate an `<Icon>` for use in any control that shows an icon
- [NoChildrenProps]($ui-core) - Props used by components that do not expect children to be passed in
- [OmitChildrenProp]($ui-core) - Omit children property
- [PointProps]($ui-core) - Describes 2d points
- [RectangleProps]($ui-core) - Describes 2d bounds
- [SizeProps]($ui-core) - Describes 2d dimensions
- [Timer]($ui-core) - Notifies handler after a set interval
- [UiCore]($ui-core) - Manages the I18N service for the ui-core package
- [useDisposable]($ui-core) - Custom hook which creates a disposable object and manages its disposal on unmount or factory method change
- [useEffectSkipFirst]($ui-core) - Custom hook which works like useEffect hook, but does not invoke callback when effect is triggered for the first time
- [useOptionalDisposable]($ui-core) - Custom hook which calls the factory method to create a disposable object which might as well be undefined. If the result was a disposable object, the hook takes care of disposing it when necessary.

## API Reference

- [Utilities]($ui-core:Utilities)
