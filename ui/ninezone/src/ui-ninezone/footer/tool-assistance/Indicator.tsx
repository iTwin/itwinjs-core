/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import { FooterIndicator, FooterIndicatorProps } from "../Indicator";
import "./Indicator.scss";

/** Properties of [[ToolAssistance]] component.
 * @beta
 */
export interface ToolAssistanceProps extends FooterIndicatorProps {
  /** Indicator label. */
  children?: string;
  /** Indicator icons. */
  icons?: React.ReactNode;
  /** Clickable part of the indicator. */
  indicatorRef?: React.Ref<HTMLDivElement>;
  /** Function called when indicator is clicked. */
  onClick?: () => void;
}

/** Tool assistance indicator used in [[Footer]] component.
 * @note Used with [[ToolAssistanceDialog]] component.
 * @beta
 */
export class ToolAssistance extends React.PureComponent<ToolAssistanceProps> {
  public render() {
    const { children, className, icons, indicatorRef, onClick, ...props } = this.props;
    return (
      <FooterIndicator
        className={classnames("nz-footer-toolAssistance-indicator", className)}
        {...props}
      >
        <div
          className="nz-indicator"
          onClick={onClick}
          ref={indicatorRef}
        >
          <div className="nz-icons">
            {icons}
          </div>
          {children !== undefined &&
            <span className="nz-content">{children}</span>
          }
          <div className="nz-triangle" />
        </div>
      </FooterIndicator>
    );
  }
}
