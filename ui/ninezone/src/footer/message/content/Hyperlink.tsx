/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../../utilities/Props";
import withTheme, { WithThemeProps } from "../../../theme/WithTheme";
import "./Hyperlink.scss";

/** Properties of [[Hyperlink]] component. */
export interface HyperlinkProps extends CommonProps, NoChildrenProps {
  /** Hyperlink text. */
  text?: string;
  /** Function called when hyperlink is clicked. */
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

/** Hyperlink component used in status message. I.e. [[MessageLayout]] */
// tslint:disable-next-line:variable-name
export const Hyperlink: React.ComponentClass<HyperlinkProps & WithThemeProps> = withTheme(HyperlinkComponent);

export default Hyperlink;
