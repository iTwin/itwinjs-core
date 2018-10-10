/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as classnames from "classnames";
import * as React from "react";
import { Link } from "react-router-dom";

import "./Navigation.scss";

export interface Props {
  className?: string;
}

export const navigation: React.StatelessComponent<Props> = (props) => {
  const className = classnames(
    "nzdemo-pages-home-navigation",
    props.className);

  return (
    <nav className={className}>
      <h2>Examples</h2>
      <ul>
        <li>
          <Link to="/zones">Zones</Link>
        </li>
        <li>
          <Link to="/backstage">Backstage</Link>
        </li>
        <li>
          <Link to="/popovers">Popovers</Link>
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
};

export default navigation;
