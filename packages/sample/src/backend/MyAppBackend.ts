/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import initLogging from "./logging";
import { IModelHost } from "@bentley/imodeljs-backend";
import { ECPresentation } from "@bentley/ecpresentation-backend";
import "./SampleRpcImpl"; // just to get the RPC implementation registered

// initialize logging
initLogging();

// initialize imodeljs-backend
IModelHost.startup();

// set up presentation manager
ECPresentation.initialize({
  rulesetDirectories: [path.resolve(__dirname, "assets/presentation_rules")],
});
