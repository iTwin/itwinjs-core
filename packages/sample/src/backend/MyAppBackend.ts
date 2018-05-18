/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import initLogging from "./logging";
import { IModelHost } from "@bentley/imodeljs-backend";
import "./SampleRpcImpl"; // just to get the RPC implementation registered

// initialize logging
initLogging();

// initialize imodeljs-backend
IModelHost.startup();

// __PUBLISH_EXTRACT_START__ Backend.Initialization.ECPresentation
import { ECPresentation } from "@bentley/ecpresentation-backend";
ECPresentation.initialize({
  rulesetDirectories: [path.join("assets", "presentation_rules")],
  localeDirectories: [path.join("assets", "locales")],
});
// __PUBLISH_EXTRACT_END__
