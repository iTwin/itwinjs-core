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

// __PUBLISH_EXTRACT_START__ Backend.Initialization.ECPresentation
// set up ECPresentation library
ECPresentation.initialize({
  rulesetDirectories: [path.resolve(__dirname, "assets/presentation_rules")],
});
// __PUBLISH_EXTRACT_END__
