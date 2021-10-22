/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { Orientation } from "@itwin/core-react";

/** @internal */
export interface PropertyGridColumnInfo {
  minLabelWidth: number;
  minValueWidth: number;
  actionButtonWidth: number;
  isMinimumColumnSizeEnabled: boolean;
}

/** @internal */
export class PropertyGridColumnStyleProvider {
  private _minLabelWidth: number = 0;
  private _minValueWidth: number = 0;
  private _actionButtonWidth: number = 0;
  private _isMinimumColumnSizeEnabled: boolean;

  public constructor(columnInfo: PropertyGridColumnInfo | undefined) {
    if (!columnInfo) {
      this._isMinimumColumnSizeEnabled = false;
      return;
    }

    this._minLabelWidth = columnInfo.minLabelWidth;
    this._minValueWidth = columnInfo.minValueWidth;
    this._actionButtonWidth = columnInfo.actionButtonWidth;
    this._isMinimumColumnSizeEnabled = columnInfo.isMinimumColumnSizeEnabled;
  }

  public get minLabelWidth() {
    return this._minLabelWidth;
  }

  public get minValueWidth() {
    return this._minValueWidth;
  }

  public get actionButtonWidth() {
    return this._actionButtonWidth;
  }

  public get isMinimumColumnSizeEnabled() {
    return this._isMinimumColumnSizeEnabled;
  }

  public getStyle(orientation: Orientation, needActionButtons: boolean, ratio: number, needElementSeparator: boolean): React.CSSProperties {
    switch (orientation) {
      case Orientation.Horizontal:
        return this.getHorizontalStyle(needActionButtons, ratio, needElementSeparator);
      case Orientation.Vertical:
        return this.getVerticalStyle(needActionButtons);
      /* istanbul ignore next */
      default:
        const unhandledOrientationType: never = orientation; // Compile time check that all cases handled
        throw new Error(`Unhandled orientation type: ${unhandledOrientationType}. Was new orientation added ? `);
    }
  }

  /** Join columns together in sequence, filtering out undefined column definitions */
  private columnStyleBuilder(columns: Array<string | undefined>): React.CSSProperties {
    columns = columns.filter((el) => el !== undefined);
    return { gridTemplateColumns: columns.join(" ") };
  }

  private getHorizontalStyle(needActionButtons: boolean, ratio: number, needElementSeparator: boolean): React.CSSProperties {
    const separatorColumn = needElementSeparator ? "1px" : undefined;
    if (!this.isMinimumColumnSizeEnabled)
      return this.columnStyleBuilder([`${ratio * 100}%`, separatorColumn, "auto", needActionButtons ? "auto" : undefined]);

    const labelColumn = `minmax(${this.minLabelWidth}px, ${ratio * 100}%)`;
    const valueColumn = `minmax(${this.minValueWidth}px, 1fr)`;
    const actionButtonColumn = needActionButtons ? `${this.actionButtonWidth}px` : undefined;

    return this.columnStyleBuilder([labelColumn, separatorColumn, valueColumn, actionButtonColumn]);
  }

  private getVerticalStyle(needActionButtons: boolean): React.CSSProperties {
    return this.columnStyleBuilder(["auto", needActionButtons ? "auto" : undefined]);
  }
}
