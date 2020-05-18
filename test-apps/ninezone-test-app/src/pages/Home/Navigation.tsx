/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./Navigation.scss";
import classnames from "classnames";
import * as React from "react";
import { Link } from "react-router-dom";

export interface Props {
  className?: string;
}

export class Navigation extends React.PureComponent<Props> {
  public render() {
    const className = classnames(
      "nzdemo-pages-home-navigation",
      this.props.className);

    return (
      <nav className={className}>
        <h2>Examples</h2>
        <ul>
          <li>
            <Link to="/zones">Zones</Link>
          </li>
          <li>
            <Link to="/stage-panels">Stage Panels</Link>
          </li>
          <li>
            <Link to="/zone-targets">Zone Targets</Link>
          </li>
          <li>
            <Link to="/footer">Footer</Link>
          </li>
          <li>
            <Link to="/tools">Tools</Link>
          </li>
        </ul>
      </nav>
    );
  }
}

export default Navigation;
