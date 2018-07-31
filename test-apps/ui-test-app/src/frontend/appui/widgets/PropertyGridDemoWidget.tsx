/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ConfigurableUiManager } from "@bentley/ui-framework";
import { WidgetControl, WidgetControlProps } from "@bentley/ui-framework";
import { ConfigurableCreateInfo } from "@bentley/ui-framework";
import { ContentControl } from "@bentley/ui-framework";

import { Orientation } from "@bentley/ui-core";
import {
  PropertyDescription, PropertyRecord, PropertyValueFormat, PrimitiveValue,
  PropertyGrid, PropertyDataProvider, SimplePropertyDataProvider,
} from "@bentley/ui-components";

class SamplePropertyRecord extends PropertyRecord {
  constructor(name: string, index: number, value: any, typename: string = "string", editor?: string) {
    const v = {
      valueFormat: PropertyValueFormat.Primitive,
      value,
      displayValue: value.toString(),
    } as PrimitiveValue;
    const p = {
      name: name + index,
      displayLabel: name,
      typename,
    } as PropertyDescription;
    if (editor)
      p.editor = { name: editor, params: [] };
    super(v, p);

    this.description = `${name} - description`;
    this.isReadonly = false;
  }
}

class SamplePropertyDataProvider extends SimplePropertyDataProvider {

  constructor() {
    super();

    this.addCategory({ name: "Group_1", label: "Group 1", expand: true });
    this.addCategory({ name: "Group_2", label: "Miscellaneous", expand: false });
    this.addCategory({ name: "Geometry", label: "Geometry", expand: true });

    const categoryCount = this.categories.length;

    for (let i = 0; i < categoryCount; i++) {
      for (let iVolume = 0; iVolume < 40; iVolume++) {

        const enumPropertyRecord = new SamplePropertyRecord("Enum", iVolume, 0, "", "enum");
        enumPropertyRecord.property.enum = { choices: [], isStrict: false };
        enumPropertyRecord.property.enum.choices = [
          { label: "Yellow", value: 0 },
          { label: "Red", value: 1 },
          { label: "Green", value: 2 },
          { label: "Blue", value: 3 },
        ];

        const booleanPropertyRecord = new SamplePropertyRecord("Boolean", iVolume, true, "boolean", "boolean");
        // booleanPropertyRecord.editorLabel = "Optional CheckBox Label";

        const propData = [
          [
            new SamplePropertyRecord("CADID", iVolume, "0000 0005 00E0 02D8"),
            new SamplePropertyRecord("ID_Attribute", iVolume, "34B72774-E885-4FB7-B031-64D040E37322"),
            new SamplePropertyRecord("Name", iVolume, "DT1002", ""),
            enumPropertyRecord,
          ],
          [
            new SamplePropertyRecord("ID", iVolume, "34B72774-E885-4FB7-B031-64D040E37322", ""),
            new SamplePropertyRecord("Model", iVolume, "Default"),
            new SamplePropertyRecord("Level", iVolume, "Default"),
            booleanPropertyRecord,
          ],
          [
            new SamplePropertyRecord("Area", iVolume, "6.1875", "ft2"),
            new SamplePropertyRecord("Height", iVolume, "1.375", "ft"),
            new SamplePropertyRecord("Width", iVolume, "4.5", "ft"),
            new SamplePropertyRecord("Integer", iVolume, "5", "", "int"),
            new SamplePropertyRecord("Float", iVolume, "7.0", "", "float"),
          ],
        ];

        // tslint:disable-next-line:prefer-for-of
        for (let j = 0; j < propData[i].length; j++) {
          this.addProperty(propData[i][j], i);
        }
      }
    }
  }
}

class VerticalPropertyGridWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    super.reactElement = <VerticalPropertyGridWidget widgetControl={this} />;
  }
}

class VerticalPropertyGridWidget extends React.Component<WidgetControlProps> {
  private _dataProvider: PropertyDataProvider;

  constructor(props: WidgetControlProps) {
    super(props);

    this._dataProvider = new SamplePropertyDataProvider();
  }

  public render() {
    return (
      <PropertyGrid dataProvider={this._dataProvider} orientation={Orientation.Vertical} />
    );
  }
}

ConfigurableUiManager.registerControl("VerticalPropertyGridDemoWidget", VerticalPropertyGridWidgetControl);

class HorizontalPropertyGridWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <HorizontalPropertyGridWidget widgetControl={this} />;
  }
}

class HorizontalPropertyGridWidget extends React.Component<WidgetControlProps> {
  private _dataProvider: PropertyDataProvider;

  constructor(props: WidgetControlProps) {
    super(props);

    this._dataProvider = new SamplePropertyDataProvider();
  }

  public render() {
    return (
      <PropertyGrid dataProvider={this._dataProvider} orientation={Orientation.Horizontal} />
    );
  }
}

ConfigurableUiManager.registerControl("HorizontalPropertyGridDemoWidget", HorizontalPropertyGridWidgetControl);

class HorizontalPropertyGridContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <HorizontalPropertyGridContent />;
  }
}

class HorizontalPropertyGridContent extends React.Component {
  private _dataProvider: PropertyDataProvider;

  constructor(props: any) {
    super(props);

    this._dataProvider = new SamplePropertyDataProvider();
  }

  public render(): React.ReactNode {
    return (
      <PropertyGrid dataProvider={this._dataProvider} orientation={Orientation.Horizontal} />
    );
  }
}

ConfigurableUiManager.registerControl("HorizontalPropertyGridDemoContent", HorizontalPropertyGridContentControl);
