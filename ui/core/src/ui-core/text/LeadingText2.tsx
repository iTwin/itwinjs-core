/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Text */

import * as React from "react";
import * as classnames from "classnames";
import { TextProps } from "./TextProps";
import "./index.scss";

/** Styled leading text */

export class LeadingText2 extends React.Component<TextProps> {
  public render(): JSX.Element {
    return (
      <span {...this.props} className={classnames("uicore-text-leading-2", this.props.className)}>
        {this.props.children}
      </span>
    );
  }
}
export default LeadingText2;
