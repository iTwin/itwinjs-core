/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Table */

import * as React from "react";
import ReactDataGrid from "react-data-grid";
import "./Grid.scss";

/** Props for the Grid React component */
export interface GridProps {
  columns: any[];
  rows: any[];
}

interface GridState {
  selectedRow: any;
}

/**
 * Grid React component
 */
export class Grid extends React.Component<GridProps, GridState> {

  public readonly state: Readonly<GridState> = {
    selectedRow: undefined,
  };

  public rowGetter(i: number) {
    return this.props.rows[i];
  }

  private _onRowClick = (rowIdx: number | undefined, _row: any) => {
    if (this.state.selectedRow === rowIdx)
      this.setState({ selectedRow: undefined });
    else
      this.setState({ selectedRow: rowIdx });
  }

  public render() {
    return (
      <div className="react-data-grid-wrapper">
        <ReactDataGrid
          columns={this.props.columns}
          rowGetter={this.rowGetter.bind(this)}
          rowsCount={this.props.rows.length}
          enableCellSelect={false}
          minHeight={500}
          headerRowHeight={25}
          rowHeight={25}
          rowSelection={{
            showCheckbox: false,
            enableShiftSelect: true,
            selectBy: {
              indexes: [this.state.selectedRow],
            },
          }}
          onRowClick={this._onRowClick}
        />
      </div>
    );
  }
}
