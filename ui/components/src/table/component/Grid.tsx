/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Table */

import * as React from "react";
import * as ReactDataGrid from "react-data-grid";
import "./Grid.scss";

/** Props for the Grid React component */
export interface GridProps {
  columns: any[];
  rows: any[];
}

interface State {
  selectedRow?: any;
}

/**
 * Grid React component
 */
export class Grid extends React.Component<GridProps, State> {

  public readonly state: Readonly<State> = {};

  public rowGetter(i: number) {
    return this.props.rows[i];
  }

  private onRowClick = (rowIdx: any, _row: any) => {
    if (this.state.selectedRow === rowIdx)
      this.setState({ selectedRow: null });
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
          onRowClick={this.onRowClick}
        />
      </div>
    );
  }
}
