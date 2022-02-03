/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Table
 */

import type { Primitives, PropertyRecord} from "@itwin/appui-abstract";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import type { CellItem, RowItem } from "../TableDataProvider";

/** Column Filtering utility methods
 * @internal
 */
export class ColumnFilteringUtilities {

  public static getCell(rowItem: RowItem, columnKey: string): CellItem | undefined {
    return rowItem.cells.find((cellItem: CellItem) => cellItem.key === columnKey);
  }

  public static getValueFromCell(rowItem: RowItem, columnKey: string): any {
    const cellItem = ColumnFilteringUtilities.getCell(rowItem, columnKey);

    // istanbul ignore next
    if (cellItem === undefined || cellItem.record === undefined)
      return undefined;

    return ColumnFilteringUtilities.getPrimitiveValue(cellItem.record);
  }

  public static getPrimitiveValue(record: PropertyRecord): Primitives.Value | undefined {
    let primitiveValue: Primitives.Value | undefined;
    const recordValue = record.value;

    // istanbul ignore else
    if (recordValue.valueFormat === PropertyValueFormat.Primitive)
      primitiveValue = recordValue.value;

    return primitiveValue;
  }

}
