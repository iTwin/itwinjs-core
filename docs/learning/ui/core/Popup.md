# Popup

The [Popup]($core-react) React component displays a popup relative to an optional target element.

## Properties

Various Popup properties, as defined in [PopupProps]($core-react), control the position and look of the popup.

The `isOpen` prop indicates whether the popup is shown or not.

The `position` prop specifies the direction to which the popup is expanded, relative to the HTML element specified by the `target` prop.

The `showShadow` prop indicates whether to show a box shadow, and the `showArrow` indicates whether to show an arrow pointing to the target element.

Several props specify handlers for certain events:
`onOpen`,
`onOutsideClick`,
`onClose`,
`onEnter`,
`onWheel` and
`onContextMenu`.

Several props control whether the popup closes for certain events (all default to `true`):
`closeOnEnter`
`closeOnWheel` and
`closeOnContextMenu`.

## Example

```tsx
   private _targetBottomLeft: HTMLElement | null = null;

. . .

<div>
  <button onClick={this._toggleBottomLeft} ref={(element) => { this._targetBottomLeft = element; }}>
    Bottom Left
  </button>
  <Popup className="popup-colors" isOpen={this.state.showBottomLeft} position={RelativePosition.BottomLeft} target={this._targetBottomLeft}
    onClose={this._onCloseBottomLeft} showArrow={true} showShadow={true}>
    {this.renderPopup("Bottom Left", this._onCloseBottomLeft)}
  </Popup>
</div>

. . .

  private renderPopup(title: string, onClose: () => any) {
    return (
      <div className="popup-test-content">
        <h4>{title}</h4>
        <div />
        <ul>
          <li onClick={onClose}>Item 1</li>
          <li onClick={onClose}>Item 2</li>
          <li onClick={onClose}>Item 3</li>
          <li onClick={onClose}>Item 4</li>
        </ul>
      </div>
    );
  }

. . .

  private _onCloseBottomLeft = () => {
    this.setState({ showBottomLeft: false });
  }

```

![popup](./images/Popup.png "Popup")

## API Reference

- [Popup]($core-react:Popup)
