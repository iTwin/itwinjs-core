/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module App */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../utilities/Props";
import "./App.scss";

/** Properties of [[App]] component. */
export interface AppProps extends CommonProps {
  /** Intended children: [[Content]], [[Zones]], [[Backstage]] */
  children?: React.ReactNode;
}

/** Root component of 9-Zone UI app. */
export default class App extends React.Component<AppProps> {
  public render() {
    const className = classnames(
      "nz-app-app",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }
}
