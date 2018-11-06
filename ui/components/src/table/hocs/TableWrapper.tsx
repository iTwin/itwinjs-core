/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Table */

import * as React from "react";
import { WithDropTargetProps } from "../../dragdrop";

/** @hidden */
export interface TableWrapperProps extends React.HTMLAttributes<HTMLDivElement> { }

/** @hidden */
export class TableWrapper extends React.Component<TableWrapperProps> {
  public render(): React.ReactNode {
    const { isOver, canDrop, item, type, ...props } = this.props as WithDropTargetProps;
    return (<div className="react-data-grid-wrapper" {...props} />);
  }
}
