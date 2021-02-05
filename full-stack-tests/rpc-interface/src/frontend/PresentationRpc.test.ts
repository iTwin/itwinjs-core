/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64, using } from "@bentley/bentleyjs-core";
import { RpcManager } from "@bentley/imodeljs-common";
import { CheckpointConnection, IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { TestFrontendAuthorizationClient } from "@bentley/oidc-signin-tool/lib/frontend";
import {
  ContentRpcRequestOptions, Descriptor, DistinctValuesRpcRequestOptions, FieldDescriptorType, HierarchyRpcRequestOptions, InstanceKey, KeySet, Paged,
  PresentationDataCompareRpcOptions, PresentationRpcInterface, PresentationStatus, RegisteredRuleset, Ruleset,
} from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import * as defaultRuleset from "./rulesets/default.json";
import * as getRelatedDistinctValues from "./rulesets/DistinctValues/getRelatedDistinctValues.json";
import * as getFilteredNodePaths from "./rulesets/NodePaths/getFilteredNodePaths.json";
import * as getNodePaths from "./rulesets/NodePaths/getNodePaths.json";
import { TestContext } from "./setup/TestContext";

/* eslint-disable deprecation/deprecation */

describe("PresentationRpcInterface tests", () => {
  let iModel: IModelConnection;
  let ruleset: Ruleset;
  let client: PresentationRpcInterface; // eslint-disable-line @typescript-eslint/no-unused-vars

  before(async function () {
    const testContext = await TestContext.instance();
    if (!testContext.settings.runPresentationRpcTests)
      this.skip();

    client = RpcManager.getClientForInterface(PresentationRpcInterface);

    await Presentation.initialize();

    const iModelId = testContext.iModelWithChangesets!.iModelId;
    const contextId = testContext.iModelWithChangesets!.contextId;
    const accessToken = testContext.adminUserAccessToken;
    IModelApp.authorizationClient = new TestFrontendAuthorizationClient(accessToken);
    iModel = await CheckpointConnection.openRemote(contextId, iModelId);
  });

  it("getNodes works as expected", async () => {
    ruleset = defaultRuleset as any;
    const props = { imodel: iModel, rulesetOrId: ruleset.id };
    await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(ruleset), async () => {
      const rootNodes1 = await Presentation.presentation.getNodes(props);
      expect(rootNodes1.length).to.be.equal(1);
    });
  });

  it("[deprecated] getNodesAndCount works as expected", async () => {
    ruleset = defaultRuleset as any;
    await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(ruleset), async () => {
      const options: Paged<HierarchyRpcRequestOptions> = {
        rulesetOrId: ruleset.id,
      };
      const nodesAndCount = await client.getNodesAndCount(iModel.getRpcProps(), options); // eslint-disable-line deprecation/deprecation
      expect(nodesAndCount.result?.count).to.not.be.undefined;
    });

  });

  it("getNodesAndCount works as expected", async () => {
    ruleset = defaultRuleset as any;
    const props = { imodel: iModel, rulesetOrId: ruleset.id };
    await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(ruleset), async () => {
      const nodesAndCount = await Presentation.presentation.getNodesAndCount(props);
      expect(nodesAndCount.count).to.not.be.undefined;
    });
  });

  it("getNodesCount works as expected", async () => {
    ruleset = defaultRuleset as any;
    const props = { imodel: iModel, rulesetOrId: ruleset.id };
    await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(ruleset), async () => {
      const count = await Presentation.presentation.getNodesCount(props);
      expect(count).to.not.be.undefined;
    });
  });

  it("getNodePath works as expected", async () => {
    ruleset = getNodePaths as any;
    const props = { imodel: iModel, rulesetOrId: ruleset.id };
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
    const props = { imodel: iModel, rulesetOrId: ruleset.id };
    await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
      const result = await Presentation.presentation.getFilteredNodePaths(props, "filter");
      expect(result).to.not.be.undefined;
    });
  });

  it("loadHierarchy works as expected", async () => {
    ruleset = defaultRuleset as any;
    const props = { imodel: iModel, rulesetOrId: ruleset.id };
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
      props = { imodel: iModel, rulesetOrId: ruleset.id };
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

    it("[deprecated] getDistinctValues works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const options: DistinctValuesRpcRequestOptions = {
          rulesetOrId: ruleset.id,
          descriptor: descriptor!,
          fieldDescriptor: {
            type: FieldDescriptorType.Name,
            fieldName: "SubCategory_DefinitionPartition_LinkPartition_PhysicalPartition_Model",
          },
          keys: keys.toJSON(),
        };
        const distinctValues = await client.getPagedDistinctValues(iModel.getRpcProps(), options);
        expect(distinctValues).to.not.be.undefined;
      });
    });

    it("getContentAndSize works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const options: Paged<ContentRpcRequestOptions> = {
          rulesetOrId: ruleset.id,
        };
        const contentAndSize = await client.getContentAndSize(iModel.getRpcProps(), options, descriptor!, keys.toJSON()); // eslint-disable-line deprecation/deprecation
        expect(contentAndSize).to.not.be.undefined;
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

    it("getDisplayLabelDefinition works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const displayLabel = await Presentation.presentation.getDisplayLabelDefinition(props, key1);
        expect(displayLabel).to.not.be.undefined;
      });
    });

    it("getDisplayLabelDefinitions works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const displayLabels = await Presentation.presentation.getDisplayLabelDefinitions(props, [key1, key2]);
        expect(displayLabels).to.not.be.undefined;
      });
    });

    it("[deprecated] getDisplayLabelDefinitions works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const displayLabels = await client.getDisplayLabelDefinitions(iModel.getRpcProps(), {}, [key1, key2]); // eslint-disable-line deprecation/deprecation
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

    it("[deprecated] comparHierarchies works as expected", async () => {
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const options: PresentationDataCompareRpcOptions = {
          prev: {
            rulesetOrId: ruleset.id,
          },
          rulesetOrId: ruleset.id,
          expandedNodeKeys: [],
        };
        const comparison = await client.compareHierarchies(iModel.getRpcProps(), options);
        expect(comparison).to.not.be.undefined;
        expect(comparison.statusCode).eq(PresentationStatus.Success);
      });
    });
  });
});
