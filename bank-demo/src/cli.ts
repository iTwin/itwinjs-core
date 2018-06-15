/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { DemoFrontend } from "./DemoFrontend";
import { DemoBackend } from "./DemoBackend";
import { sideLoadChangeSets } from "./sideLoadChangeSets";

const useIModelHub = (process.argv.length === 3) && (process.argv[2] === "1");

// Pretend that we are spinning up the app's own backend
const backend = new DemoBackend();
DemoBackend.initialize(useIModelHub);

// Pretend that this is the app's frontend
const frontend = new DemoFrontend(useIModelHub);

async function runDemo() {
  await frontend.login();
  const iModelId = await frontend.chooseIModel();
  const context = await frontend.getIModelAccessContext(iModelId);
  await sideLoadChangeSets(context, frontend.accessToken);
  await backend.downloadBriefcase(context, frontend.accessToken);
  await backend.logChangeSets(context, frontend.accessToken);
}

runDemo().then(() => process.exit(0));
