/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PropertyDescription } from "@itwin/appui-abstract";
import { CellItem, RowItem, TableDataProvider, TypeConverterManager } from "@itwin/components-react";

export interface TableCellProps {
  tableDataProvider: TableDataProvider;
  columnProperty: PropertyDescription;
  value: any;
  rowIndex: number;
  cellKey: string;
  useCellPropertyDescription?: boolean;
}

export function ReactTableCell(props: TableCellProps) {
  const { columnProperty, tableDataProvider, value, rowIndex, cellKey, useCellPropertyDescription } = props;
  const [displayValue, setDisplayValue] = React.useState<string>();

  const getCellItem = (rowItem: RowItem, colKey: string): CellItem | undefined => {
    return rowItem.cells.find((cellItem) => cellItem.key === colKey);
  };

  React.useEffect(() => {
    const formatValue = async () => {
      let cellProperty: PropertyDescription | undefined;
      if (useCellPropertyDescription) {
        const rowItem = await tableDataProvider.getRow(rowIndex);
        const cellItem = getCellItem(rowItem, cellKey);
        cellProperty = cellItem ? cellItem.record?.property : undefined;
      }

      const description = cellProperty ?? columnProperty;

      let formattedValue = "";
      const potentialValue = TypeConverterManager
        .getConverter(description.typename, description.converter?.name)
        .convertPropertyToString(description, value);
      if (typeof potentialValue === "string")
        formattedValue = potentialValue;
      else
        formattedValue = await potentialValue;

      setDisplayValue(formattedValue);
    };

    formatValue();  // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [cellKey, columnProperty, rowIndex, tableDataProvider, useCellPropertyDescription, value]);

  return (
    <span>
      {displayValue}
    </span>
  );
}
