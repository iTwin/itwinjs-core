/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import * as React from "react";

import "./PropertyLabelRenderer.scss";

/** @hidden */
export interface PropertyLabelRendererProps {
  /** Label to be rendered */
  children: string;
  renderColon?: boolean;
}

/** @hidden */
export class PropertyLabelRenderer extends React.PureComponent<PropertyLabelRendererProps> {
  /** Get React CSS style object based on provided offset from the left side */
  public static getStyle(offset?: number): React.CSSProperties {
    offset = offset ? offset : 0;
    return {
      paddingLeft: offset,
      width: `calc(100% - ${offset}px)`,
    };
  }

  public render() {
    return (
      <>
        <span className="components-property-label-renderer" title={this.props.children}>
          {this.props.children}
        </span>
        {this.props.renderColon ? <span className="components-property-label-renderer-colon">:</span> : undefined}
      </>
    );
  }
}
