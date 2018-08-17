/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import Readme from "../Readme/Readme";

import "./Home.scss";
import Navigation from "./Navigation";
const packagesJson = require("@src/../package.json"); // tslint:disable-line

export const home: React.StatelessComponent = () => (
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

export default home;
