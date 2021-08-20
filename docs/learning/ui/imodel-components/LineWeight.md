# LineWeight

The [LineWeight]($ui-imodel-components:LineWeight) category in the `@bentley/ui-imodel-components` package includes
classes and components for working with and picking a Line Weight.

|Component|Description
|-----|-----
|[LineWeightSwatch]($ui-imodel-components)|displays a line weight swatch in a button
|[WeightPickerButton]($ui-imodel-components)|used to pick a line weight from an array of available weights

## WeightPickerButton Sample

The following sample shows the WeightPickerButton component used to pick a line weight.

### State

```tsx
interface State {
  . . .
  weight: number;
}
```

### render() Method

```tsx
<WeightPickerButton activeWeight={this.state.weight} onLineWeightPick={this._handleWeightChange} />
```

### Handler Function

```tsx
private _handleWeightChange = (value: number) => {
  this.setState({weight: value});
}
```

![WeightPickerButton](./images/WeightPickerButton.png "WeightPickerButton Component")

**Note:** The properties for the WeightPickerButton are defined in the [WeightPickerProps]($ui-imodel-components) interface. The optional `weights` prop may be used to provide the available weights.

## API Reference

- [LineWeight]($ui-imodel-components:LineWeight)
