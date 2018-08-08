/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";

import Merge, { MergeCell, MergeProps } from "./Merge";
import "./Unmerge.scss";

export enum CellType {
  Unmerge,
  Merge,
}

export interface UnmergeCell extends MergeCell {
  type: CellType;
}

export interface UnmergeProps extends MergeProps {
  cells: UnmergeCell[];
}

export default class Unmerge extends React.Component<UnmergeProps> {
  public render() {
    const { className, cells, ...props } = this.props;

    const mergeClassName = classnames(
      "nz-zones-target-unmerge",
      className,
      this.props.className);

    const mergeCells = cells.map((cell) => {
      const mergeCellClassName = classnames(
        cell.className,
        cell.type === CellType.Merge && "nz-merge",
      );

      const mergeCell: MergeCell = {
        className: mergeCellClassName,
        col: cell.col,
        row: cell.row,
      };

      return mergeCell;
    });

    return (
      <Merge
        className={mergeClassName}
        cells={mergeCells}
        {...props}
      />
    );
  }
}
