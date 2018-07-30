/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";

import { CellProps } from "../../utilities/Cell";

import "./Merge.scss";
import Target, { TargetProps } from "./Target";

export interface MergeCell extends CellProps {
  className?: string;
}

export interface MergeProps extends TargetProps {
  columns: number;
  rows: number;
  cells: MergeCell[];
}

export default class Merge extends React.Component<MergeProps> {
  public render() {
    const targetClassName = classnames(
      "nz-zones-target-merge",
      this.props.className);

    const { className, columns, rows, cells, ...props } = this.props;

    const targetCells = [];
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++) {
        const cell = this.props.cells.find((c) => row === c.row && col === c.col);
        const cellClassName = classnames(
          cell && "nz-cell",
          cell && cell.className,
          row !== 0 && "nz-top-border",
          col !== 0 && "nz-left-border",
          row === 0 && "nz-top-outline",
          row === (rows - 1) && "nz-bottom-outline",
          col === 0 && "nz-left-outline",
          col === (columns - 1) && "nz-right-outline",
        );

        targetCells.push(
          <div
            key={row + "_" + col}
            style={{
              gridRow: row + 1,
              gridColumn: col + 1,
            }}
            className={cellClassName}
          />,
        );
      }

    return (
      <Target
        className={targetClassName}
        {...props}
      >
        <div className="nz-grid">
          {targetCells}
        </div>
      </Target>
    );
  }
}
