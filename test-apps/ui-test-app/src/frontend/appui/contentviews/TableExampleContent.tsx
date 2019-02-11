/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ConfigurableUiManager, ConfigurableCreateInfo, ContentControl } from "@bentley/ui-framework";
import { PropertyRecord, PropertyValueFormat, PropertyValue, PropertyDescription } from "@bentley/imodeljs-frontend";
import {
  Table, ColumnDescription, RowItem, TableDataProvider,
  SimpleTableDataProvider, TableSelectionTarget, SelectionMode,
  PropertyUpdatedArgs, TableCellUpdatedArgs,
} from "@bentley/ui-components";

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
      },
      {
        key: "title",
        label: "Title",
        sortable: true,
        resizable: true,
        editable: true,
      },
      {
        key: "color",
        label: "Color",
        sortable: true,
        resizable: false,
        editable: true,
      },
    ];

    const rows = new Array<RowItem>();
    for (let i = 1; i <= 100000; i++) {
      const row: RowItem = { key: i.toString(), cells: [] };
      row.cells.push({
        key: "id",
        record: createPropertyRecord(i, columns[0], "int"),
      });
      row.cells.push({
        key: "title",
        record: createPropertyRecord("Title " + i, columns[1], "text"),
      });
      row.cells.push({
        key: "color",
        record: createEnumPropertyRecord(i, columns[2]),
      });
      rows.push(row);
    }

    const dataProvider = new SimpleTableDataProvider(columns);
    dataProvider.setItems(rows);

    this.state = { dataProvider, selectedIndexes: [], selectionMode: SelectionMode.Single, tableSelectionTarget: TableSelectionTarget.Row };
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

  public render(): React.ReactNode {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexFlow: "column" }}>
        <div style={{ marginBottom: "4px" }}>
          <select onChange={this._onChangeSelectionMode}>
            <option value={SelectionMode.Single}> Single </option>
            < option value={SelectionMode.SingleAllowDeselect} > SingleAllowDeselect </option>
            < option value={SelectionMode.Multiple} > Multiple </option>
            < option value={SelectionMode.Extended} > Extended </option>
          </select>
          < select onChange={this._onChangeTableSelectionTarget} >
            <option value={TableSelectionTarget.Row}> Row </option>
            < option value={TableSelectionTarget.Cell} > Cell </option>
          </select>
        </div>
        <div style={{ flex: "1", height: "calc(100% - 22px)" }}>
          <Table
            dataProvider={this.state.dataProvider}
            tableSelectionTarget={this.state.tableSelectionTarget}
            selectionMode={this.state.selectionMode}
            onPropertyUpdated={this._handlePropertyUpdated}
          />
        </div>
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("TableExampleContent", TableExampleContentControl);
