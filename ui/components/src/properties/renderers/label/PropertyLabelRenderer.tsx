/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import * as React from "react";
import { Popup, Position } from "@bentley/ui-core";

import "./PropertyLabelRenderer.scss";

/** @hidden */
export interface PropertyLabelRendererProps {
  /** Label to be rendered */
  children: string;
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
        <span className="components-property-label-renderer">
          {this.props.children}
        </span>
        <span className="components-property-label-renderer-dots">
          :
        </span>
        <Popup showOnHover={true} position={Position.Top} showTime={500}>
          <div className="components-label-popup">
            {this.props.children}
          </div>
        </Popup>
      </>
    );
  }
}
