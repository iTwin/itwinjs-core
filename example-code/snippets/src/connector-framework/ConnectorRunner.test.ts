/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {HubArgs, JobArgs} from "./Args";
import { BentleyStatus} from "@itwin/core-bentley";
import { ConnectorRunner } from "./ConnectorRunner";

async function runConnector(jobArgs: JobArgs, hubArgs: HubArgs) {
  const testConnector = "testconnector.js";
  const runner = new ConnectorRunner(jobArgs, hubArgs);

  // __PUBLISH_EXTRACT_START__ ConnectorRunnerTest.run.example-code

  const status = await runner.run(testConnector);

  // __PUBLISH_EXTRACT_END__

  if (status !== BentleyStatus.SUCCESS)
    throw new Error();
}

const ha = new HubArgs({});
const ja = new JobArgs({});
void runConnector (ja, ha);

