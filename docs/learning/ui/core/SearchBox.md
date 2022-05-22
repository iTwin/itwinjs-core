# SearchBox

The [SearchBox]($core-react) React component displays an
input box with an icon right justified bounded by the SearchBox.
When the input box is empty, a magnifying glass icon is displayed.
When text has been entered, a 'X' close, or clear, icon is displayed.

## Properties

The SearchBox component has numerous properties, as defined in the [SearchBoxProps]($core-react) interface.

There is one required prop: `onValueChanged`, which is triggered when the content of SearchBox is changed. Use this function to react to the text entered in the SearchBox. The frequency of polling for changes can be controlled by the `valueChangedDelay` prop.

The `placeholder` prop specifies text to display when no search value has been entered yet.

There are 3 event handler props:

- `onEnterPressed` - listens for `Enter` key press
- `onEscPressed` - listens for `Esc` key press
- `onClear` - listens for `onClick` event for Clear (X) icon

## Example

In this example, the required `onValueChanged` prop and the optional `placeholder` prop are specified.

```tsx
<SearchBox onValueChanged={(value: string) => console.log(`Search text: ${value}`)} placeholder="Search" />
```

![searchbox](./images/SearchBox.png "SearchBox")

After some text has been entered, the icon switches to the X/Clear icon.

![searchbox x](./images/SearchBoxX.png "SearchBox with Clear icon")

### Dark Theme

![searchbox dark](./images/SearchBoxDark.png "SearchBox in Dark Theme")

## API Reference

- [SearchBox]($core-react:SearchBox)
