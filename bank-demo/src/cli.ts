/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { DemoFrontend } from "./DemoFrontend";
import { DemoBackend } from "./DemoBackend";
import { IModelAccessContext } from "@bentley/imodeljs-backend/lib/backend";

const useIModelHub = true;

// Pretend that we are spinning up the app's own backend
const backend = new DemoBackend();
DemoBackend.initialize(useIModelHub);

// Pretend that this is the app's frontend
const frontend = new DemoFrontend(useIModelHub);

// Simulate an app, where the user in the frontend logs in, picks a project, and then calls IModelConnection.open
frontend.login()
  .then(() => frontend.chooseIModel())
  .then((iModelId: string) => frontend.getIModelAccessContext(iModelId))
  .then((accessContext: IModelAccessContext) => backend.downloadBriefcase(accessContext, frontend.accessToken));
