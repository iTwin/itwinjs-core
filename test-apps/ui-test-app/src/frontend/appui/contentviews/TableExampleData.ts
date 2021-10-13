/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { LoremIpsum } from "lorem-ipsum";

import {
  AlternateDateFormats, BasePropertyEditorParams, InputEditorSizeParams, PropertyDescription,
  PropertyEditorInfo, PropertyEditorParamTypes, PropertyRecord, PropertyValue, PropertyValueFormat, RangeEditorParams,
  SliderEditorParams, StandardEditorNames, StandardTypeNames, TimeDisplay,
} from "@itwin/appui-abstract";
import {
  ColumnDescription, FilterRenderer, RowItem, SimpleTableDataProvider, TableDataProvider,
} from "@itwin/components-react";

// cSpell:ignore datetime

const createPropertyRecord = (value: any, column: ColumnDescription, typename: string, editor?: PropertyEditorInfo) => {
  const v: PropertyValue = {
    valueFormat: PropertyValueFormat.Primitive,
    value,
    displayValue: value,
  };
  const pd: PropertyDescription = {
    typename,
    name: column.key,
    displayLabel: column.label,
    editor,
  };
  column.propertyDescription = pd;
  return new PropertyRecord(v, pd);
};

const createDatePropertyRecord = (value: any, column: ColumnDescription, option: number) => {
  const v: PropertyValue = {
    valueFormat: PropertyValueFormat.Primitive,
    value,
  };

  let typename = StandardTypeNames.DateTime;
  let converter: any;

  switch (option) {
    case 0:
      typename = StandardTypeNames.DateTime;
      break;
    case 1:
      typename = StandardTypeNames.ShortDate;
      break;
    case 2:
      typename = StandardTypeNames.DateTime;
      converter = { options: { timeDisplay: TimeDisplay.H24M } }; // DateTime with 24hr time
      break;
    case 3:
      typename = StandardTypeNames.DateTime;
      converter = { options: { timeDisplay: TimeDisplay.H24MS } }; // DateTime with 24hr time
      break;
    case 4:
      typename = StandardTypeNames.DateTime;
      converter = { options: { timeDisplay: TimeDisplay.H12MSC } }; // DateTime with 12hr time
      break;
    case 5:
      typename = StandardTypeNames.ShortDate;
      converter = { name: "mm-dd-yyyy" };
      break;
    case 6:
      typename = StandardTypeNames.DateTime;
      converter = { options: { alternateDateFormat: AlternateDateFormats.IsoDateTime } };
      break;
    case 7:
      typename = StandardTypeNames.ShortDate;
      converter = { options: { alternateDateFormat: AlternateDateFormats.IsoShort } };
      break;
    case 8:
      typename = StandardTypeNames.ShortDate;
      converter = { options: { alternateDateFormat: AlternateDateFormats.UtcShort } };
      break;
    case 9:
      typename = StandardTypeNames.ShortDate;
      converter = { options: { alternateDateFormat: AlternateDateFormats.UtcShortWithDay } };
      break;
    case 10:
      typename = StandardTypeNames.DateTime;
      converter = { options: { alternateDateFormat: AlternateDateFormats.UtcDateTime } };
      break;
    case 11:
      typename = StandardTypeNames.DateTime;
      converter = { options: { alternateDateFormat: AlternateDateFormats.UtcDateTimeWithDay } };
      break;
  }

  const pd: PropertyDescription = {
    typename, // ShortDate | DateTime
    converter,
    name: column.key,
    displayLabel: column.label,
  };
  column.propertyDescription = pd;
  return new PropertyRecord(v, pd);
};

const createEnumPropertyRecord = (rowIndex: number, column: ColumnDescription) => {
  const value = rowIndex % 4;
  const v: PropertyValue = {
    valueFormat: PropertyValueFormat.Primitive,
    value,
    displayValue: value.toString(),
  };
  const pd: PropertyDescription = {
    typename: StandardTypeNames.Enum,
    name: column.key,
    displayLabel: column.label,
  };
  column.propertyDescription = pd;
  const enumPropertyRecord = new PropertyRecord(v, pd);
  enumPropertyRecord.property.enum = { choices: [], isStrict: false };
  enumPropertyRecord.property.enum.choices = [
    { label: "Yellow", value: 0 },
    { label: "Red", value: 1 },
    { label: "Green", value: 2 },
    { label: "Blue", value: 3 },
  ];
  return enumPropertyRecord;
};

const createLoremPropertyRecord = (column: ColumnDescription) => {
  const lorem = new LoremIpsum();
  const value = lorem.generateWords(3);

  const v: PropertyValue = {
    valueFormat: PropertyValueFormat.Primitive,
    value,
    displayValue: value,
  };

  const editorParams: BasePropertyEditorParams[] = [];
  const inputSizeParams: InputEditorSizeParams = {
    type: PropertyEditorParamTypes.InputEditorSize,
    size: 30,
  };
  editorParams.push(inputSizeParams);

  const pd: PropertyDescription = {
    typename: StandardTypeNames.Text,
    name: column.key,
    displayLabel: column.label,
    editor: { name: StandardEditorNames.MultiLine, params: editorParams },
  };
  column.propertyDescription = pd;
  return new PropertyRecord(v, pd);
};

export class TableExampleData {
  private _dataProvider: SimpleTableDataProvider = new SimpleTableDataProvider([]);
  private _columns: ColumnDescription[] = [
    {
      key: "id",
      label: "ID",
      resizable: true,
      sortable: true,
      width: 70,
      editable: true,
      filterable: true,
      filterRenderer: FilterRenderer.Numeric,
    },
    {
      key: "date",
      label: "Date",
      sortable: true,
      resizable: true,
      editable: true,
      filterable: true,
      width: 200,
      filterRenderer: FilterRenderer.MultiSelect,
      sortType: "datetime",
    },
    {
      key: "title",
      label: "Title",
      sortable: true,
      resizable: true,
      editable: true,
      filterable: true,
      filterRenderer: FilterRenderer.MultiValue,
    },
    {
      key: "color",
      label: "Color",
      sortable: true,
      resizable: true,
      editable: true,
      width: 90,
      filterable: true,
      filterRenderer: FilterRenderer.SingleSelect,
    },
    {
      key: "lorem",
      label: "Lorem",
      resizable: true,
      editable: true,
      filterable: true,
      filterRenderer: FilterRenderer.Text,
    },
  ];

  public get columns(): ColumnDescription[] { return this._columns; }
  public get dataProvider(): TableDataProvider { return this._dataProvider; }

  public loadData(useUtc: boolean) {
    const editorParams: BasePropertyEditorParams[] = [];
    const sliderParams: SliderEditorParams = {
      type: PropertyEditorParamTypes.Slider,
      minimum: 1,
      maximum: 100,
      step: 1,
      showTooltip: true,
      tooltipBelow: true,
    };
    const rangeParams: RangeEditorParams = {
      type: PropertyEditorParamTypes.Range,
      minimum: 1,
      maximum: 100,
    };
    editorParams.push(sliderParams);
    editorParams.push(rangeParams);

    const rows = new Array<RowItem>();
    for (let i = 1; i <= 1000 /* 00 */; i++) {
      const row: RowItem = { key: i.toString(), cells: [] };
      row.cells.push({
        key: this._columns[0].key,
        record: createPropertyRecord(i, this._columns[0], StandardTypeNames.Int, { name: StandardEditorNames.Slider, params: editorParams }),
      });
      const monthValue = i % 12;
      const dayValue = i % 28;
      const day = new Date();
      if (useUtc) {
        day.setUTCFullYear(2019, monthValue, dayValue);
        day.setUTCHours(0, 0, 0, 0);
      } else {
        day.setFullYear(2019, monthValue, dayValue);
        day.setHours(0, 0, 0, 0);
      }
      row.cells.push({
        key: this._columns[1].key,
        record: createDatePropertyRecord(day, this._columns[1], (i - 1) % 12), // 12 different options (0-11)
      });
      row.cells.push({
        key: this._columns[2].key,
        record: createPropertyRecord(`Title ${i}`, this._columns[2], StandardTypeNames.String),
      });
      row.cells.push({
        key: this._columns[3].key,
        record: createEnumPropertyRecord(i, this._columns[3]),
      });
      row.cells.push({
        key: this._columns[4].key,
        record: createLoremPropertyRecord(this._columns[4]),
      });
      rows.push(row);
    }

    this._dataProvider = new SimpleTableDataProvider(this._columns);
    this._dataProvider.setItems(rows);
  }

}
