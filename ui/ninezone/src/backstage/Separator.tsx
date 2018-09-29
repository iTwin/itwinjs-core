/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as classnames from "classnames";
import * as React from "react";
import Props from "../utilities/Props";
import "./Separator.scss";

/** Item separator in the [[Backstage]]. */
export default class BackstageSeparator extends React.Component<Props> {
  public render() {
    const className = classnames(
      "nz-backstage-separator",
      this.props.className);

    return (
      <div className={className} style={this.props.style} />
    );
  }
}
