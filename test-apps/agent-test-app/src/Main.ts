/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { QueryAgentWebServer } from "./QueryAgentWebServer";
import * as express from "express";

// Create Query Agent Web Server
const app: express.Express = express();
const queryAgentWebServer = new QueryAgentWebServer(app);
queryAgentWebServer.start(app);

// queryAgentWebServer.run().then((res) => {
//     queryAgentWebServer.close();
//     if (res) {
//         // Exit gracefully
//         process.exit();
//     } else {
//         // Exit with error code
//         process.exit(1);
//     }
// });
