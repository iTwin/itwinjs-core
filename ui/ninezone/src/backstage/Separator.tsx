/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
