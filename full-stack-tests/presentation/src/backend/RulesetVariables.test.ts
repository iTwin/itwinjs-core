/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelDb, SnapshotDb } from "@itwin/core-backend";
import { Guid } from "@itwin/core-bentley";
import { PresentationManager } from "@itwin/presentation-backend";
import { Ruleset, RuleTypes } from "@itwin/presentation-common";
import { initialize, terminate } from "../IntegrationTests.js";

describe("Ruleset variables", () => {
  let imodel: IModelDb;

  before(async () => {
    await initialize();
    imodel = SnapshotDb.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    expect(imodel).is.not.null;
  });

  after(async () => {
    imodel.close();
    await terminate();
  });

  describe("set and get through native addon", () => {
    it("round-trips `int` variable", () => {
      using manager = new PresentationManager();
      const vars = manager.vars(Guid.createValue());
      vars.setInt("int-var", 123);
      expect(vars.getInt("int-var")).to.eq(123);
    });

    it("round-trips `int[]` variable", () => {
      using manager = new PresentationManager();
      const vars = manager.vars(Guid.createValue());
      vars.setInts("int-array-var", [1, 2, 3]);
      expect(vars.getInts("int-array-var")).to.deep.eq([1, 2, 3]);
    });

    it("round-trips `bool` variable", () => {
      using manager = new PresentationManager();
      const vars = manager.vars(Guid.createValue());
      vars.setBool("bool-var", true);
      expect(vars.getBool("bool-var")).to.eq(true);
    });

    it("round-trips `string` variable", () => {
      using manager = new PresentationManager();
      const vars = manager.vars(Guid.createValue());
      vars.setString("string-var", "test value");
      expect(vars.getString("string-var")).to.eq("test value");
    });

    it("round-trips `id64` variable", () => {
      using manager = new PresentationManager();
      const vars = manager.vars(Guid.createValue());
      vars.setId64("id64-var", "0x123");
      expect(vars.getId64("id64-var")).to.eq("0x123");
    });

    it("round-trips `id64[]` variable", () => {
      using manager = new PresentationManager();
      const vars = manager.vars(Guid.createValue());
      vars.setId64s("id64-array-var", ["0x1", "0x2", "0x3"]);
      expect(vars.getId64s("id64-array-var")).to.deep.eq(["0x1", "0x2", "0x3"]);
    });
  });

  it("applies natively-set `int` variable in a rule condition", async () => {
    using manager = new PresentationManager();
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.RootNodes,
          condition: `GetVariableIntValue("DISPLAY_LEVEL") = 1`,
          specifications: [{ specType: "CustomNode", type: "T", label: "Test node" }],
        },
      ],
    };

    // Register the ruleset up front and reference it by id in `getNodes`. Passing the ruleset
    // object directly would register it under a hashed id, which would put the variable we set
    // below (scoped to `rulesetId`) into a different scope than the one used to evaluate the rules.
    using registered = manager.rulesets().add(ruleset);

    // Variable not set - condition evaluates to false, so no nodes are returned.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    let nodes = await manager.getNodes({ imodel, rulesetOrId: registered.id });
    expect(nodes).to.be.empty;

    // Set the variable through the native addon and confirm it affects the hierarchy.
    manager.vars(registered.id).setInt("DISPLAY_LEVEL", 1);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    nodes = await manager.getNodes({ imodel, rulesetOrId: registered.id });
    expect(nodes).to.have.lengthOf(1);
    expect(nodes[0].label.displayValue).to.eq("Test node");
  });
});
