/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./Router.scss";
import * as React from "react";
import { HashRouter, Route, Switch } from "react-router-dom";

const Home = React.lazy(() => import("./pages/Home/Home" /* webpackChunkName: "Home" */));
const Footer = React.lazy(() => import("./pages/Footer" /* webpackChunkName: "Footer" */));
const StagePanels = React.lazy(() => import("./pages/StagePanels" /* webpackChunkName: "StagePanels" */));
const Tools = React.lazy(() => import("./pages/Tools" /* webpackChunkName: "Tools" */));
const Zones = React.lazy(() => import("./pages/Zones" /* webpackChunkName: "Zones" */));
const Zones2 = React.lazy(() => import("./pages/Zones/Zones" /* webpackChunkName: "Zones2" */));
const ZoneTargets = React.lazy(() => import("./pages/ZoneTargets" /* webpackChunkName: "ZoneTargets" */));

export default function Router() {
  return (
    <HashRouter>
      <React.Suspense fallback="Loading...">
        <Switch>
          <Route exact path="/" component={Home} />
          <Route path="/zones" component={Zones} />
          <Route path="/zones2" component={Zones2} />
          <Route path="/stage-panels" component={StagePanels} />
          <Route path="/zone-targets" component={ZoneTargets} />
          <Route path="/footer" component={Footer} />
          <Route path="/tools" component={Tools} />
        </Switch>
      </React.Suspense>
    </HashRouter>
  );
}
