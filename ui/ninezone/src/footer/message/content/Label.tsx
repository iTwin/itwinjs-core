/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../../utilities/Props";
import withTheme, { WithThemeProps } from "../../../theme/WithTheme";
import "./Label.scss";

export interface LabelProps extends CommonProps {
  children?: string;
}

// tslint:disable-next-line:variable-name
const LabelComponent: React.StatelessComponent<LabelProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-label",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      {props.children}
    </div>
  );
};

// tslint:disable-next-line:variable-name
export const Label: React.ComponentClass<CommonProps & WithThemeProps> = withTheme(LabelComponent);

export default Label;
