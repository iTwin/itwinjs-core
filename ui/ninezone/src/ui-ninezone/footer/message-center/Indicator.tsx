/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";
import { FooterIndicator, FooterIndicatorProps } from "../Indicator";
import "./Indicator.scss";

/** Properties of [[MessageCenter]] component.
 * @beta
 */
export interface MessageCenterProps extends FooterIndicatorProps {
  /** Message center balloon content. */
  children?: string;
  /** Clickable part of the indicator. */
  indicatorRef?: React.Ref<HTMLDivElement>;
  /** Message center label. */
  label?: string;
  /** Function called when indicator is clicked. */
  onClick?: () => void;
  /** Message center dialog target. */
  targetRef?: React.Ref<HTMLDivElement>;
}

/** Message center indicator used in [[Footer]] component.
 * @note Used with [[MessageCenterDialog]] component.
 * @beta
 */
export class MessageCenter extends React.PureComponent<MessageCenterProps> {
  public render() {
    const { children, className, indicatorRef, label, onClick, targetRef, ...props } = this.props;
    return (
      <FooterIndicator
        className={classnames("nz-footer-messageCenter-indicator", this.props.className)}
        {...props}
      >
        <div
          className="nz-indicator"
          onClick={onClick}
          ref={indicatorRef}
        >
          {label !== undefined &&
            <span className="nz-label">{label}</span>
          }
          <div className="nz-container">
            <div className="nz-balloon">
              <div className="nz-arrow" />
              <div className="nz-content">
                {children}
              </div>
            </div>
            <div
              className="nz-target"
              ref={targetRef}
            />
          </div>
        </div>
      </FooterIndicator>
    );
  }
}
