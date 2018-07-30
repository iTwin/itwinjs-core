/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Footer */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../utilities/Props";
import "./Footer.scss";

/** Properties of [[Footer]] component. */
export interface FooterProps extends CommonProps, NoChildrenProps {
  /**
   * Status indicators.
   * I.e: [[ToolAssistanceIndicator]], [[SnapModeIndicator]], [[MessageCenterIndicator]]
   */
  indicators?: React.ReactNode;
  /** Specifies if the footer is in widget mode.  */
  isInWidgetMode?: boolean;
  /** One of footer messages: [[Toast]], [[Temporary]], [[Sticky]], [[Modal]], [[Activity]] */
  message?: React.ReactNode;
}

/** Footer component. Should be used in [[FooterZone]] */
// tslint:disable-next-line:variable-name
export const Footer: React.StatelessComponent<FooterProps> = (props: FooterProps) => {
  const className = classnames(
    "nz-footer-footer",
    props.isInWidgetMode && "nz-widget-mode",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      <div className="nz-message">
        {props.message}
      </div>
      <div className="nz-indicators">
        {props.indicators}
      </div>
    </div>
  );
};

export default Footer;
