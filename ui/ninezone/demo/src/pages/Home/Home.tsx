/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import Readme from "../Readme/Readme";
import "./Home.scss";
import Navigation from "./Navigation";
const packagesJson = require("@src/../../package.json"); // tslint:disable-line

export class Home extends React.PureComponent {
  public render() {
    return (
      <div className={"nzdemo-pages-home-home"}>
        <div className="sidebar">
          <Navigation className="navigation" />
          <span className="version">Version: <b>{packagesJson.version}</b></span>
        </div>
        <section>
          <Readme />
        </section>
      </div>
    );
  }
}

export default Home;
