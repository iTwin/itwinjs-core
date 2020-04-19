/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Config } from "../Config";

describe("Config", () => {

  it("should set primitive values", () => {
    Config.App.set("A", 1);
    Config.App.set("B", "strValue");
    Config.App.set("C", "${A}_${B}");
    assert.equal(1, Config.App.get("A"));
    assert.equal(1, Config.App.query("A"));
    assert.equal("strValue", Config.App.query("B"));
    assert.equal("1_strValue", Config.App.query("C"));
    // NEEDSWORK_CONFIG assert.equal("test", Config.App.get("NODE_ENV"));
  });

  it("should throw for missing variable", () => {
    assert.throws(() => Config.App.get("badvar"), Error, "The configuration variable 'badvar' does not exist.");
    assert.isUndefined(Config.App.query("badvar"));
  });

  it("Test var name case", () => {
    Config.App.set("Camel", "yEs");
    assert.equal("yEs", Config.App.get("camel"));
    assert.equal("yEs", Config.App.get("Camel"));
    assert.equal("yEs", Config.App.get("cAmeL"));
    assert.equal("yEs", Config.App.get("caMeL"));
    assert.equal("yEs", Config.App.get("CAMEL"));
    assert.equal("yEs", Config.App.query("camel"));
    assert.equal("yEs", Config.App.query("Camel"));
    assert.equal("yEs", Config.App.query("cAmeL"));
    assert.equal("yEs", Config.App.query("caMeL"));
    assert.equal("yEs", Config.App.query("CAMEL"));
    Config.App.set("CAMEL", "no");
    assert.equal("no", Config.App.get("camel"));
    assert.equal("no", Config.App.get("Camel"));
    assert.equal("no", Config.App.get("cAmeL"));
    assert.equal("no", Config.App.get("caMeL"));
    assert.equal("no", Config.App.get("CAMEL"));
    assert.equal("no", Config.App.query("camel"));
    assert.equal("no", Config.App.query("Camel"));
    assert.equal("no", Config.App.query("cAmeL"));
    assert.equal("no", Config.App.query("caMeL"));
    assert.equal("no", Config.App.query("CAMEL"));
    /* ------- NEEDSWORK_CONFIG
    assert.equal("test", Config.App.get("NODE_ENV"));
    assert.equal("test", Config.App.get("node_env"));
    assert.equal("test", Config.App.get("Node_Env"));
    -------------- */
  });

  it("variable expansion check case insensitive matching", () => {
    Config.App.set("Apple", 101);
    Config.App.set("Banana", "202");
    Config.App.set("My_Apple", "${apple}_${Apple}_${aPPle}_${APPLE}");
    Config.App.set("My_Banana", "${banana}_${Banana}_${bANANa}_${BANANA}");

    assert.equal(101, Config.App.get("APPLE"));
    assert.equal(101, Config.App.query("APPLE"));
    assert.equal("101_101_101_101", Config.App.get("MY_APPLE"));
    assert.equal("101_101_101_101", Config.App.query("MY_APPLE"));

    assert.equal("101_101_101_101", Config.App.get("MY_APPLE"));
    assert.equal("101_101_101_101", Config.App.query("MY_APPLE"));
    assert.equal("202_202_202_202", Config.App.get("MY_BANANA"));
    assert.equal("202_202_202_202", Config.App.query("MY_BANANA"));
  });

  it("variable expansion multi-level", () => {
    Config.App.set("primitive", 2);
    Config.App.set("env", "${primitive}");
    Config.App.set("multiple", "${env}");

    assert.equal(2, Config.App.get("primitive"));
    assert.equal(2, Config.App.get("env"));
    assert.equal(2, Config.App.get("multiple"));
  });

  it("variable expansion should throw for missing variable", () => {
    Config.App.set("test", "${obscure_name}");
    assert.throws(() => Config.App.get("obscure_name"), Error, "The configuration variable 'obscure_name' does not exist.");
  });

  it("merging", () => {
    const testConfig = {
      testa: 2,
      testb: "three",
      testc: 4,
    };
    Config.App.merge(testConfig);
    assert.equal(Config.App.get("testa"), 2);
    assert.equal(Config.App.get("testb"), "three");
    assert.equal(Config.App.get("testc"), 4);

    // Overwrite the previous value
    Config.App.merge({
      testb: 3,
    });

    assert.equal(Config.App.get("testb"), 3);
  });

  it("clone", () => {
    const newContainer = Config.App.getContainer();
    assert(newContainer !== (Config.App as any)._container);

    assert.deepEqual(newContainer, (Config.App as any)._container);
  });

});
