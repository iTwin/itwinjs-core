/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as testbedConfig from "../config";
import { assert } from "chai";

describe("Testbed Server", () => {
  it("should serve swagger.json", () => {
    const info = testbedConfig.gatewayParams.info;
    const req = new XMLHttpRequest();
    req.open("GET", `http://localhost:${testbedConfig.serverPort}${testbedConfig.swaggerURI}`, false);
    req.send();
    const desc = JSON.parse(req.responseText);
    assert(desc.info.title === info.title && desc.info.version === info.version);
  });
});
