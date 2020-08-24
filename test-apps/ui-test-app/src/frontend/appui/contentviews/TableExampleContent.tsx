/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { LoremIpsum } from "lorem-ipsum";
import * as React from "react";
import {
  BasePropertyEditorParams, InputEditorSizeParams, PropertyDescription, PropertyEditorInfo,
  PropertyEditorParamTypes, PropertyRecord, PropertyValue, PropertyValueFormat, RangeEditorParams, SliderEditorParams,
  StandardEditorNames, StandardTypeNames,
} from "@bentley/ui-abstract";
import {
  ColumnDescription, FilterRenderer, PropertyUpdatedArgs, RowItem, SelectionMode, SimpleTableDataProvider,
  Table, TableCellContextMenuArgs, TableCellUpdatedArgs, TableDataProvider, TableSelectionTarget,
} from "@bentley/ui-components";
import { BodyText, Toggle } from "@bentley/ui-core";
import { ConfigurableCreateInfo, ConfigurableUiManager, ContentControl } from "@bentley/ui-framework";

class TableExampleContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <TableExampleContent />;
  }
}

interface TableExampleState {
  dataProvider: TableDataProvider;
  selectionMode: SelectionMode;
  tableSelectionTarget: TableSelectionTarget;
  selectedIndexes: any[];
  requestedTopRow: number;
  topRow: number;
  filtering: boolean;
}

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
  const value = lorem.generateWords(5);

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

class TableExampleContent extends React.Component<{}, TableExampleState>  {
  public readonly state: Readonly<TableExampleState>;

  private _columns: ColumnDescription[] = [
    {
      key: "id",
      label: "ID",
      resizable: true,
      sortable: true,
      width: 90,
      editable: true,
      filterable: true,
      filterRenderer: FilterRenderer.Numeric,
    },
    {
      key: "title",
      label: "Title",
      sortable: true,
      resizable: true,
      editable: true,
      filterable: true,
      filterRenderer: FilterRenderer.MultiSelect,
    },
    {
      key: "color",
      label: "Color",
      sortable: true,
      resizable: true,
      editable: true,
      width: 180,
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

  constructor(props: any) {
    super(props);

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
      row.cells.push({
        key: this._columns[1].key,
        record: createPropertyRecord(`Title ${i}`, this._columns[1], StandardTypeNames.String),
      });
      row.cells.push({
        key: this._columns[2].key,
        record: createEnumPropertyRecord(i, this._columns[2]),
      });
      row.cells.push({
        key: this._columns[3].key,
        record: createLoremPropertyRecord(this._columns[3]),
      });
      rows.push(row);
    }

    const dataProvider = new SimpleTableDataProvider(this._columns);
    dataProvider.setItems(rows);

    this.state = {
      dataProvider,
      selectedIndexes: [],
      selectionMode: SelectionMode.Single,
      tableSelectionTarget: TableSelectionTarget.Row,
      requestedTopRow: 0,
      topRow: 0,
      filtering: true,
    };
  }

  private _onChangeSelectionMode = (e: React.ChangeEvent<HTMLSelectElement>) => {
    let selectionMode: SelectionMode;

    switch (e.target.value) {
      case "1":
        selectionMode = SelectionMode.Single;
        break;
      case "5":
        selectionMode = SelectionMode.SingleAllowDeselect;
        break;
      case "6":
        selectionMode = SelectionMode.Multiple;
        break;
      case "12":
        selectionMode = SelectionMode.Extended;
        break;
      default: selectionMode = SelectionMode.Single;
    }
    this.setState({ selectionMode });
  }

  private _onChangeTableSelectionTarget = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === "0") {
      this.setState({ tableSelectionTarget: TableSelectionTarget.Row });
      return;
    }

    this.setState({ tableSelectionTarget: TableSelectionTarget.Cell });
  }

  private _updatePropertyRecord(record: PropertyRecord, newValue: PropertyValue): PropertyRecord {
    return record.copyWithNewValue(newValue);
  }

  private _handlePropertyUpdated = async (propertyArgs: PropertyUpdatedArgs, cellArgs: TableCellUpdatedArgs): Promise<boolean> => {
    let updated = false;

    if (propertyArgs.propertyRecord) {
      propertyArgs.propertyRecord = this._updatePropertyRecord(propertyArgs.propertyRecord, propertyArgs.newValue);
      if (cellArgs.rowIndex >= 0) {
        const rowItem = await this.state.dataProvider.getRow(cellArgs.rowIndex);
        if (rowItem) {
          const cellItem = rowItem.cells.find((cell) => cell.key === cellArgs.cellKey);
          if (cellItem) {
            cellItem.record = propertyArgs.propertyRecord;
            updated = true;
          }
        }
      }
    }

    return updated;
  }

  private _onRequestedTopRowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value !== null) {
      const value = parseInt(e.target.value, 10);
      this.setState({ requestedTopRow: value });
    }
  }

  private _onScrollToRow = (topRowIndex: number) => {
    this.setState({ topRow: topRowIndex });
  }

  private _handleCellContextMenu = (args: TableCellContextMenuArgs) => {
    // eslint-disable-next-line no-console
    console.log(`rowIndex ${args.rowIndex}, colIndex ${args.colIndex}, cellKey ${args.cellKey}`);
  }

  private _onFilteringChange = (checked: boolean) => {
    this._columns.forEach((column: ColumnDescription) => {
      column.filterable = checked;
    });
    this.state.dataProvider.onColumnsChanged.raiseEvent();
    this.state.dataProvider.onRowsChanged.raiseEvent();
  }

  public render(): React.ReactNode {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexFlow: "column" }}>
        <div style={{ marginTop: "3px", marginBottom: "4px" }}>
          <select onChange={this._onChangeSelectionMode}>
            <option value={SelectionMode.Single}> Single </option>
            < option value={SelectionMode.SingleAllowDeselect} > SingleAllowDeselect </option>
            < option value={SelectionMode.Multiple} > Multiple </option>
            < option value={SelectionMode.Extended} > Extended </option>
          </select>
          <Gap />
          <select onChange={this._onChangeTableSelectionTarget} >
            <option value={TableSelectionTarget.Row}> Row </option>
            < option value={TableSelectionTarget.Cell} > Cell </option>
          </select>
          <Gap />
          <label>
            <BodyText>Top row:</BodyText>
            &nbsp;
            <input onChange={this._onRequestedTopRowChange} style={{ width: "100px" }} />
            &nbsp;
            <span>({this.state.topRow})</span>
          </label>
          <Gap />
          <label>
            <BodyText>Filtering:</BodyText>
            &nbsp;
            <Toggle isOn={this.state.filtering} onChange={this._onFilteringChange} />
          </label>
        </div>
        <div style={{ flex: "1", height: "calc(100% - 22px)" }}>
          <Table
            dataProvider={this.state.dataProvider}
            tableSelectionTarget={this.state.tableSelectionTarget}
            selectionMode={this.state.selectionMode}
            onPropertyUpdated={this._handlePropertyUpdated}
            scrollToRow={this.state.requestedTopRow}
            onScrollToRow={this._onScrollToRow}
            onCellContextMenu={this._handleCellContextMenu}
            stripedRows={true}
          />
        </div>
      </div>
    );
  }
}

function Gap() {
  return (
    <span style={{ paddingLeft: "10px" }} />
  );
}

ConfigurableUiManager.registerControl("TableExampleContent", TableExampleContentControl);
