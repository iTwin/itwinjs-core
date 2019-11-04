/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ConfigurableUiManager, ConfigurableCreateInfo, ContentControl } from "@bentley/ui-framework";
import { PropertyRecord, PropertyValueFormat, PropertyValue, PropertyDescription } from "@bentley/imodeljs-frontend";
import {
  Table, ColumnDescription, RowItem, TableDataProvider, FilterRenderer,
  SimpleTableDataProvider, TableSelectionTarget, SelectionMode,
  PropertyUpdatedArgs, TableCellUpdatedArgs,
} from "@bentley/ui-components";
import { BodyText } from "@bentley/ui-core";
import { LoremIpsum } from "lorem-ipsum";

class TableExampleContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <TableExampleContent />;
  }
}

interface TableExampleState {
  dataProvider: TableDataProvider;
  selectionMode: SelectionMode;
  tableSelectionTarget: TableSelectionTarget;
  selectedIndexes: any[];
  requestedTopRow: number;
  topRow: number;
}

const createPropertyRecord = (value: any, column: ColumnDescription, typename: string) => {
  const v: PropertyValue = {
    valueFormat: PropertyValueFormat.Primitive,
    value,
    displayValue: value,
  };
  const pd: PropertyDescription = {
    typename,
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
    typename: "enum",
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
  const pd: PropertyDescription = {
    typename: "text",
    name: column.key,
    displayLabel: column.label,
  };
  column.propertyDescription = pd;
  return new PropertyRecord(v, pd);
};

class TableExampleContent extends React.Component<{}, TableExampleState>  {
  public readonly state: Readonly<TableExampleState>;

  constructor(props: any) {
    super(props);

    const columns: ColumnDescription[] = [
      {
        key: "id",
        label: "ID",
        resizable: true,
        sortable: true,
        width: 90,
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
        filterable: true,
        filterRenderer: FilterRenderer.Text,
      },
    ];

    const rows = new Array<RowItem>();
    for (let i = 1; i <= 100000; i++) {
      const row: RowItem = { key: i.toString(), cells: [] };
      row.cells.push({
        key: columns[0].key,
        record: createPropertyRecord(i, columns[0], "int"),
      });
      row.cells.push({
        key: columns[1].key,
        record: createPropertyRecord("Title " + i, columns[1], "text"),
      });
      row.cells.push({
        key: columns[2].key,
        record: createEnumPropertyRecord(i, columns[2]),
      });
      row.cells.push({
        key: columns[3].key,
        record: createLoremPropertyRecord(columns[3]),
      });
      rows.push(row);
    }

    const dataProvider = new SimpleTableDataProvider(columns);
    dataProvider.setItems(rows);

    this.state = {
      dataProvider,
      selectedIndexes: [],
      selectionMode: SelectionMode.Single,
      tableSelectionTarget: TableSelectionTarget.Row,
      requestedTopRow: 0,
      topRow: 0,
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
          <select onChange={this._onChangeTableSelectionTarget} >
            <option value={TableSelectionTarget.Row}> Row </option>
            < option value={TableSelectionTarget.Cell} > Cell </option>
          </select>
          <label>
            <BodyText>Top row:</BodyText>
            <input onChange={this._onRequestedTopRowChange} style={{ width: "100px" }} />
            <span>({this.state.topRow})</span>
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
          />
        </div>
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("TableExampleContent", TableExampleContentControl);
