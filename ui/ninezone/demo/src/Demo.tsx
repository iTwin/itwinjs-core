/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  HashRouter,
  Route,
} from "react-router-dom";

import Backstage from "./pages/Backstage";
import Home from "./pages/Home/Home";
import Popovers from "./pages/Popovers";
import Zones from "./pages/Zones";
import ZoneTargets from "./pages/ZoneTargets";
import Footer from "./pages/Footer";
import Tools from "./pages/Tools";

export default class Demo extends React.Component {
  public render() {
    return (
      <HashRouter>
        <>
          <Route exact path="/" component={Home} />
          <Route path="/zones" component={Zones} />
          <Route path="/backstage" component={Backstage} />
          <Route path="/popovers" component={() => <Popovers isPopoverOpen />} />
          <Route path="/zone-targets" component={ZoneTargets} />
          <Route path="/footer" component={Footer} />
          <Route path="/tools" component={Tools} />
        </>
      </HashRouter>
    );
  }
}
