/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";
import { FooterIndicator, FooterIndicatorProps } from "../Indicator";
import "./Indicator.scss";

/** Properties of [[SnapMode]] component.
 * @beta
 */
export interface SnapModeProps extends FooterIndicatorProps {
  /** Indicator label. */
  children?: string;
  /** Indicator icon. I.e. [[SnapModeIcon]] */
  icon?: React.ReactNode;
  /** Clickable part of the indicator. */
  indicatorRef?: React.Ref<HTMLDivElement>;
  /** Function called when indicator is clicked. */
  onClick?: () => void;
}

/** Snap mode indicator used in [[Footer]] component.
 * @note Used with [[SnapModePanel]] component.
 * @beta
 */
export class SnapMode extends React.PureComponent<SnapModeProps> {
  public render() {
    const { children, className, icon, indicatorRef, onClick, ...props } = this.props;
    return (
      <FooterIndicator
        className={classnames("nz-footer-snapMode-indicator", this.props.className)}
        {...props}
      >
        <div
          className="nz-indicator"
          onClick={onClick}
          ref={indicatorRef}
        >
          {children !== undefined &&
            <span className="nz-label">{children}</span>
          }
          <div
            className="nz-icon"
          >
            {icon}
          </div>
        </div>
      </FooterIndicator>
    );
  }
}
