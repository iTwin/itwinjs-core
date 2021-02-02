# Dialog

The [Dialog]($ui-core) React component displays a floating dialog with optional resizing and dragging functionality.

## Properties

The many Dialog properties, as defined in [DialogProps]($ui-core), control resize and move capabilities, header, footer, placement, sizing, event handlers and custom styling.

The `opened` prop, which is the only mandatory prop, indicates whether to show the dialog.

The `resizable` prop indicates whether the user can resize the dialog. The default is false.

The `movable` prop indicates whether the user can move the dialog. The default is false.

The `inset` prop indicates whether the content should be inset. The default is true.

### Header and Footer

The `title` prop specifies the text to show in the header, or title bar, of the dialog.

The `buttonCluster` prop is a list of `DialogButtonDef` objects specifying buttons and associated onClick events. These buttons display in the footer at the bottom of the dialog.

The header can be hidden using the `hideHeader` prop.

The header can be overridden using the `header` prop.

The footer can be overridden using the `footer` prop. This overrides the `buttonCluster` prop.

### Placement

The `alignment` prop indicates where to align the dialog. The default is `DialogAlignment.Center`.

The `x` prop specifies the initial x/left position of dialog in px.

The `y` prop specifies the initial y/top position of dialog in px.

### Sizing

The `width` prop specifies the initial width of dialog. Displayed in px if value is a number; otherwise, it is displayed in specified CSS unit. The default is "50%".

The `height` prop specifies the initial height of dialog. Specified in px if value is a number; otherwise, it is displayed in specified CSS unit.

The `minWidth` prop specifies the minimum width that the dialog may be resized to. Default is 300px.

The `minHeight` prop specifies the minimum height that the dialog may be resized to. Default is 100px.

The `maxWidth` prop specifies the maximum width that the dialog may be resized to.

The `maxHeight` props specifies the maximum height that the dialog may be resized to.

### Event Handlers

The `onClose` handler function is called when the 'X' button for dialog is clicked or touched.

The `onEscape` handler function is called on a 'keyup' event for the Esc key.

The `onOutsideClick` handler function is called when a click/touch occurs outside of the dialog.

### Modeless Dialogs

By default, a Dialog is modal. A Dialog may be specified as modeless (non-modal) by setting the `modal` prop to false.

Modeless dialogs require an id specified by the `modelessId` prop and an implementation of the `onModelessPointerDown` prop.

### Custom Styling

Several props may be used to override styling.

The `backgroundStyle` prop specifies CSS properties for the background overlay.

The `titleStyle` prop specifies CSS properties for the title.

The `footerStyle` prop specifies CSS properties for the footer.

The `contentClassName` prop specifies a CSS class name for the content area.

The `contentStyle` prop specifies CSS properties for the content area.

## API Reference

- [Dialog]($ui-core:Dialog)
