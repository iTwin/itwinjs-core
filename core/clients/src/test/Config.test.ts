/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Config } from "../Config";

describe("Config", () => {

  it("should set primitive values", () => {
    Config.App.set("A", 1);
    Config.App.set("B", "strValue");
    Config.App.set("C", "${A}_${B}");
    assert.equal(1, Config.App.get("A"));
    assert.equal("strValue", Config.App.get("B"));
    assert.equal("1_strValue", Config.App.get("C"));
    assert.equal("test", Config.App.get("NODE_ENV"));
  });
});
