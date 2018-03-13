/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import initLogging from "./logging";
import { IModelDb, IModelHost } from "@bentley/imodeljs-backend";
import ECPresentationManager from "@bentley/ecpresentation-backend/lib/ECPresentationManager";

// initialize logging
initLogging();

// initialize imodeljs-backend
IModelHost.startup();

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
