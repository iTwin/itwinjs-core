/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { Ruleset, RegisteredRuleset, InstanceKey, KeySet, Descriptor, PresentationRpcInterface } from "@bentley/presentation-common";
import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend";
import { IModelTokenProps, RpcManager } from "@bentley/imodeljs-common";

import { Presentation } from "@bentley/presentation-frontend";
import { using, Id64 } from "@bentley/bentleyjs-core";

import { TestContext } from "./setup/TestContext";
import { AuthorizationClient } from "./setup/AuthorizationClient";
import * as defaultRuleset from "./rulesets/default.json";
import * as getNodePaths from "./rulesets/NodePaths/getNodePaths.json";
import * as getFilteredNodePaths from "./rulesets/NodePaths/getFilteredNodePaths.json";
import * as getRelatedDistinctValues from "./rulesets/DistinctValues/getRelatedDistinctValues.json";

describe("PresentationRpcInterface tests", () => {
  let iModel: IModelConnection;
  let ruleset: Ruleset;
  let client: PresentationRpcInterface;

  before(async function () {
    const testContext = await TestContext.instance();
    if (!testContext.settings.runPresentationRpcTests)
      this.skip();

    client = RpcManager.getClientForInterface(PresentationRpcInterface);

    await Presentation.initialize();

    const iModelId = testContext.iModelWithChangesets!.iModelId;
    const contextId = testContext.iModelWithChangesets!.contextId;
    const accessToken = testContext.adminUserAccessToken;
    (IModelApp.authorizationClient as AuthorizationClient).setAccessToken(accessToken);
    iModel = await IModelConnection.open(contextId, iModelId);
  });

  it("getNodes works as expected", async () => {
    ruleset = defaultRuleset as any;
    const props = { imodel: iModel, rulesetId: ruleset.id };
    await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(ruleset), async () => {
      const rootNodes1 = await Presentation.presentation.getNodes(props);
      expect(rootNodes1.length).to.be.equal(1);
    });
  });

  it("getNodesAndCount works as expected", async () => {
    ruleset = defaultRuleset as any;
    const props = { imodel: iModel, rulesetId: ruleset.id };
    await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(ruleset), async () => {
      const nodesAndCount = await Presentation.presentation.getNodesAndCount(props);
      expect(nodesAndCount.count).to.not.be.undefined;
      expect(nodesAndCount.count).to.not.be.undefined;
    });
  });

  it("getNodesCount works as expected", async () => {
    ruleset = defaultRuleset as any;
    const props = { imodel: iModel, rulesetId: ruleset.id };
    await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(ruleset), async () => {
      const count = await Presentation.presentation.getNodesCount(props);
      expect(count).to.not.be.undefined;
    });
  });

  it("getNodePath works as expected", async () => {
    ruleset = getNodePaths as any;
    const props = { imodel: iModel, rulesetId: ruleset.id };
    await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(ruleset), async () => {
      const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:RepositoryModel" };
      const key2: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
      const key3: InstanceKey = { id: Id64.fromString("0x10"), className: "BisCore:DefinitionPartition" };
      const key4: InstanceKey = { id: Id64.fromString("0xe"), className: "BisCore:LinkPartition" };
      const keys: InstanceKey[][] = [[key1, key2, key3], [key1, key2, key4]];

      const result = await Presentation.presentation.getNodePaths(props, keys, 1);
      expect(result).to.not.be.undefined;
    });
  });

  it("getFilteredNodePaths works as expected", async () => {
    ruleset = getFilteredNodePaths as any;
    const props = { imodel: iModel, rulesetId: ruleset.id };
    await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
      const result = await Presentation.presentation.getFilteredNodePaths(props, "filter");
      expect(result).to.not.be.undefined;
    });
  });

  it("loadHierarchy works as expected", async () => {
    ruleset = defaultRuleset as any;
    const props = { imodel: iModel, rulesetId: ruleset.id };
    await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(ruleset), async () => {
      let success = true;
      try {
        await Presentation.presentation.loadHierarchy(props);
      } catch (ex) {
        success = false;
      }
      expect(success).to.be.true;
    });
  });

  it("syncClientState works as expected", async () => {
    ruleset = defaultRuleset as any;
    await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(ruleset), async () => {
      const result = await client.syncClientState(iModel.iModelToken.toJSON() as IModelTokenProps, { state: { rulesets: [ruleset] } });
      expect(result).to.not.be.undefined;
    });
  });

  describe("tests that require a descriptor", async () => {
    let descriptor: Descriptor | undefined;
    let props: any;
    const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
    const key2: InstanceKey = { id: Id64.fromString("0x17"), className: "BisCore:SpatialCategory" };
    const keys = new KeySet([key1, key2]);

    before(async function () {
      // Needed in all nested describes.  See https://github.com/mochajs/mocha/issues/2683.
      const testContext = await TestContext.instance();
      if (!testContext.settings.runPresentationRpcTests)
        this.skip();

      ruleset = getRelatedDistinctValues as any;
      props = { imodel: iModel, rulesetId: ruleset.id };
    });

    it("getContentDescriptor works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        descriptor = await Presentation.presentation.getContentDescriptor(props, "Grid", keys, undefined);
        expect(descriptor).to.not.be.undefined;
      });
    });

    it("getDistinctValues works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const distinctValues = await Presentation.presentation.getDistinctValues(props, descriptor!, keys,
          "SubCategory_DefinitionPartition_LinkPartition_PhysicalPartition_Model");
        expect(distinctValues).to.not.be.undefined;
      });
    });

    it("getContentAndSize works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const contentAndSize = await Presentation.presentation.getContentAndSize(props, descriptor!, keys);
        expect(contentAndSize).to.not.be.undefined;
      });
    });

    it("getContent works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const content = await Presentation.presentation.getContent(props, descriptor!, keys);
        expect(content).to.not.be.undefined;
      });
    });

    it("getContentSetSize works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const contentSetSize = await Presentation.presentation.getContentSetSize(props, descriptor!, keys);
        expect(contentSetSize).to.not.be.undefined;
      });
    });

    it("getDisplayLabel works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const displayLabel = await Presentation.presentation.getDisplayLabel(props, key1);
        expect(displayLabel).to.not.be.undefined;
      });
    });

    it("getDisplayLabels works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const displayLabels = await Presentation.presentation.getDisplayLabels(props, [key1, key2]);
        expect(displayLabels).to.not.be.undefined;
      });
    });

    it("getDisplayLabelDefinition works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const displayLabel = await Presentation.presentation.getDisplayLabelDefinition(props, key1);
        expect(displayLabel).to.not.be.undefined;
      });
    });

    it("getDisplayLabelDefinitions works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const displayLabels = await Presentation.presentation.getDisplayLabelsDefinitions(props, [key1, key2]);
        expect(displayLabels).to.not.be.undefined;
      });
    });

    it("getSelectionScopes works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const scopeIds = await Presentation.selection.scopes.getSelectionScopes(iModel);
        expect(scopeIds).to.not.be.undefined;
      });
    });

    it("computeSelection works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const computedSelections = await Presentation.selection.scopes.computeSelection(iModel, [key1.id, key2.id], "element");
        expect(computedSelections).to.not.be.undefined;
      });
    });
  });
});
