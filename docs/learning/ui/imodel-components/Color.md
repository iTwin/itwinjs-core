# Color

The [Color]($imodel-components-react:Color) category in the `@itwin/imodel-components-react` package includes
classes and components for working with and picking a Color.

|Component|Description
|-----|-----
|[AlphaSlider]($imodel-components-react)|used to set the alpha value for a color
|[ColorPickerButton]($imodel-components-react)|used to pick a color from an array of available colors
|[HueSlider]($imodel-components-react)|used to set the hue value for a color
|[SaturationPicker]($imodel-components-react)|used to set the saturation value for a color
|[ColorSwatch]($imodel-components-react)|displays a color swatch in a button

## Samples

### Multiple Color Components Used Together

The following sample shows the components above used together to form a color picker.

#### Imports

```tsx
import { HSVColor, ColorDef, ColorByName } from "@itwin/core-common";
import { SaturationPicker, HueSlider, ColorSwatch } from "@itwin/imodel-components-react";
```

#### State

```tsx
interface State {
  . . .
  shadowColor: ColorDef;
}
```

#### Preset Colors

```tsx
private readonly _presetColors = [
  new ColorDef(ColorByName.grey),
  new ColorDef(ColorByName.lightGrey),
  new ColorDef(ColorByName.darkGrey),
  new ColorDef(ColorByName.lightBlue),
  new ColorDef(ColorByName.lightGreen),
  new ColorDef(ColorByName.darkGreen),
  new ColorDef(ColorByName.tan),
  new ColorDef(ColorByName.darkBrown),
];
```

#### render() method

```tsx
    const colorSwatchStyle: React.CSSProperties = {
      width: `100%`,
      height: `100%`,
    };
. . .
<div >
  <div className="shadow-settings-color">
    <div className="shadow-settings-color-top">
      <SaturationPicker hsv={this.state.shadowColor.toHSV()} onSaturationChange={this._handleHueOrSaturationChange} />
    </div>
    <div className="shadow-settings-color-bottom">
      <div className="shadow-settings-color-bottom-left">
        <HueSlider hsv={this.state.shadowColor.toHSV()} onHueChange={this._handleHueOrSaturationChange} isHorizontal={true} />
      </div>
      <div className="shadow-settings-color-bottom-right">
        <ColorSwatch style={colorSwatchStyle} colorDef={this.state.shadowColor} round={false} />
      </div>
    </div>
  </div>
  <div className="shadow-settings-color-presets">
    <ColorSwatch colorDef={this._presetColors[0]} round={false} onColorPick={this._onPresetColorPick} />
    <ColorSwatch colorDef={this._presetColors[1]} round={false} onColorPick={this._onPresetColorPick} />
    <ColorSwatch colorDef={this._presetColors[2]} round={false} onColorPick={this._onPresetColorPick} />
    <ColorSwatch colorDef={this._presetColors[3]} round={false} onColorPick={this._onPresetColorPick} />
    <ColorSwatch colorDef={this._presetColors[4]} round={false} onColorPick={this._onPresetColorPick} />
    <ColorSwatch colorDef={this._presetColors[5]} round={false} onColorPick={this._onPresetColorPick} />
    <ColorSwatch colorDef={this._presetColors[6]} round={false} onColorPick={this._onPresetColorPick} />
    <ColorSwatch colorDef={this._presetColors[7]} round={false} onColorPick={this._onPresetColorPick} />
  </div>
</div>
```

#### Handler Functions

```tsx
private _onPresetColorPick = (shadowColor: ColorDef) => {
  this.setState({ shadowColor }, () => this.props.dataProvider.shadowColor = shadowColor);
}

private _handleHueOrSaturationChange = (hueOrSaturation: HSVColor) => {
  if (hueOrSaturation.s === 0)  // for a ColorDef to be created from hsv s can't be 0
    hueOrSaturation.s = 0.5;
  const shadowColor = hueOrSaturation.toColorDef();
  this.setState({ shadowColor }, () => this.props.dataProvider.shadowColor = shadowColor);
}
```

![color-components](./images/color-components.png "Color Components")

### ColorPickerButton Sample

The following sample shows the ColorPickerButton component used to pick a color.

#### Imports

```tsx
import { ColorDef } from "@itwin/core-common";
import { ColorPickerButton } from "@itwin/imodel-components-react";
```

#### State

```tsx
interface State {
  . . .
  color: ColorDef;
}
```

#### render() method

```tsx
<ColorPickerButton initialColor={this.state.color} onColorPick={this._handleColorChange} />
```

#### Handler Function

```tsx
private _handleColorChange = (value: ColorDef) => {
  this.setState({color: value});
}
```

![ColorPickerButton](./images/ColorPickerButton.png "ColorPickerButton Component")

**Note:** The properties for the ColorPickerButton are defined in the [ColorPickerProps]($imodel-components-react) interface. The optional `colorDefs` prop may be used to provide the available colors.

## API Reference

- [Color]($imodel-components-react:Color)
