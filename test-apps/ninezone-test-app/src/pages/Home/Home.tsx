/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./Home.scss";
import "@bentley/ui-core/lib/ui-core/colorthemes.scss";
import * as React from "react";
import Navigation from "./Navigation";
import Readme from "./Readme";
const packageJson = require("@bentley/ui-ninezone/package.json");

export class Home extends React.PureComponent {
  public render() {
    return (
      <div className="nzdemo-pages-home-home">
        <div className="sidebar">
          <Navigation className="navigation" />
          <span className="version">Version: <b>{packageJson.version}</b></span>
        </div>
        <section>
          <React.Suspense fallback="Readme loading...">
            <Readme />
          </React.Suspense>
        </section>
      </div>
    );
  }
}

export default Home;
