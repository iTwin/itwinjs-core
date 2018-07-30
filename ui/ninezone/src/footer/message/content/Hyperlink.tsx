/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../../utilities/Props";
import withTheme, { WithThemeProps } from "../../../theme/WithTheme";
import "./Hyperlink.scss";

export interface HyperlinkProps extends CommonProps {
  text?: string;
  onClick?: () => void;
}

// tslint:disable-next-line:variable-name
const HyperlinkComponent: React.StatelessComponent<HyperlinkProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-hyperlink",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
      onClick={props.onClick}
    >
      {props.text}
    </div>
  );
};

// tslint:disable-next-line:variable-name
export const Hyperlink: React.ComponentClass<HyperlinkProps & WithThemeProps> = withTheme(HyperlinkComponent);

export default Hyperlink;
