/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import initLogging from "./logging";
import { IModelDb } from "@bentley/imodeljs-backend/lib/backend/IModelDb";
import ECPresentationManager from "@bentley/ecpresentation-backend/lib/backend/ECPresentationManager";
import { NodeAddonRegistry } from "@bentley/imodeljs-backend/lib/backend/NodeAddonRegistry";

// initialize logging
initLogging();

// initialize the node addon
NodeAddonRegistry.loadAndRegisterStandardAddon();

// ensure that the imodeljs-core backend is included
IModelDb;

// set up presentation manager
const presentationManager = new ECPresentationManager({
  rulesetDirectories: [path.resolve(__dirname, "assets/presentation_rules")],
});

// create the app object
const app = {
  presentation: presentationManager,
};
export default app;
