/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { HashRouter, Route } from "react-router-dom";
import Home from "./pages/Home/Home";
import Footer from "./pages/Footer";
import StagePanels from "./pages/StagePanels";
import Tools from "./pages/Tools";
import Zones from "./pages/Zones";
import ZoneTargets from "./pages/ZoneTargets";

export default class Demo extends React.PureComponent {
  public render() {
    return (
      <HashRouter>
        <>
          <Route exact path="/" component={Home} />
          <Route path="/zones" component={Zones} />
          <Route path="/stage-panels" component={StagePanels} />
          <Route path="/zone-targets" component={ZoneTargets} />
          <Route path="/footer" component={Footer} />
          <Route path="/tools" component={Tools} />
        </>
      </HashRouter>
    );
  }
}
