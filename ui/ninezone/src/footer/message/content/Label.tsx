/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../../utilities/Props";
import { withTheme, WithThemeProps } from "../../../theme/WithTheme";
import "./Label.scss";

/** Properties of [[Label]] component. */
export interface LabelProps extends CommonProps, NoChildrenProps {
  /** Label text. */
  text?: string;
}

class LabelComponent extends React.PureComponent<LabelProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-content-label",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.text}
      </div>
    );
  }
}

/** Label component used in status message. I.e. [[MessageLayout]] */
// tslint:disable-next-line:variable-name
export const Label: React.ComponentClass<LabelProps & WithThemeProps> = withTheme(LabelComponent);
