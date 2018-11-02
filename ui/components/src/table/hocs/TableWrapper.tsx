import * as React from "react";
import { WithDropTargetProps } from "../../dragdrop";

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Table */

export interface TableWrapperProps extends React.HTMLAttributes<HTMLDivElement> { }

export class TableWrapper extends React.Component<TableWrapperProps> {
  public render(): React.ReactNode {
    const { isOver, canDrop, item, type, ...props } = this.props as WithDropTargetProps;
    return (<div className="react-data-grid-wrapper" {...props} />);
  }
}
