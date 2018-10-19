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

  it("Test var name case", () => {
    Config.App.set("Camel", "yEs");
    assert.equal("yEs", Config.App.get("camel"));
    assert.equal("yEs", Config.App.get("Camel"));
    assert.equal("yEs", Config.App.get("cAmeL"));
    assert.equal("yEs", Config.App.get("caMeL"));
    assert.equal("yEs", Config.App.get("CAMEL"));
    Config.App.set("CAMEL", "no");
    assert.equal("no", Config.App.get("camel"));
    assert.equal("no", Config.App.get("Camel"));
    assert.equal("no", Config.App.get("cAmeL"));
    assert.equal("no", Config.App.get("caMeL"));
    assert.equal("no", Config.App.get("CAMEL"));
    assert.equal("test", Config.App.get("NODE_ENV"));
    assert.equal("test", Config.App.get("node_env"));
    assert.equal("test", Config.App.get("Node_Env"));
  });

  it("Case var substitution test", () => {
    Config.App.set("Apple", 101);
    Config.App.set("Banana", "202");
    Config.App.set("My_Apple", "${apple}_${Apple}_${aPPle}_${APPLE}");
    Config.App.set("My_Banana", "${banana}_${Banana}_${bANANa}_${BANANA}");

    assert.equal(101, Config.App.get("APPLE"));
    assert.equal("101_101_101_101", Config.App.get("MY_APPLE"));
    assert.equal("202_202_202_202", Config.App.get("MY_BANANA"));
  });

});
