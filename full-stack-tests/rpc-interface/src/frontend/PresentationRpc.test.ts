/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64 } from "@bentley/bentleyjs-core";
import { CheckpointConnection, IModelApp, IModelConnection } from "@itwin/core-frontend";
import { TestFrontendAuthorizationClient } from "@bentley/oidc-signin-tool/lib/frontend";
import { InstanceKey, KeySet, Ruleset } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import * as defaultRuleset from "./rulesets/default.json";
import * as getRelatedDistinctValues from "./rulesets/DistinctValues/getRelatedDistinctValues.json";
import * as getFilteredNodePaths from "./rulesets/NodePaths/getFilteredNodePaths.json";
import * as getNodePaths from "./rulesets/NodePaths/getNodePaths.json";
import { TestContext } from "./setup/TestContext";

describe("PresentationRpcInterface tests", () => {

  let imodel: IModelConnection;

  before(async function () {
    const testContext = await TestContext.instance();
    if (!testContext.settings.runPresentationRpcTests)
      this.skip();

    await Presentation.initialize();

    const iModelId = testContext.iModelWithChangesets!.iModelId;
    const iTwinId = testContext.iModelWithChangesets!.iTwinId;
    const accessToken = testContext.adminUserAccessToken;
    IModelApp.authorizationClient = new TestFrontendAuthorizationClient(accessToken);
    imodel = await CheckpointConnection.openRemote(iTwinId, iModelId);
  });

  after(() => {
    Presentation.terminate();
  });

  it("getNodes works as expected", async () => {
    const rootNodes = await Presentation.presentation.getNodes({
      imodel,
      rulesetOrId: defaultRuleset as Ruleset,
    });
    expect(rootNodes.length).to.be.equal(1);
  });

  it("getNodesAndCount works as expected", async () => {
    const nodesAndCount = await Presentation.presentation.getNodesAndCount({
      imodel,
      rulesetOrId: defaultRuleset as Ruleset,
    });
    expect(nodesAndCount.count).to.not.be.undefined;
  });

  it("getNodesCount works as expected", async () => {
    const count = await Presentation.presentation.getNodesCount({
      imodel,
      rulesetOrId: defaultRuleset as Ruleset,
    });
    expect(count).to.not.be.undefined;
  });

  it("getNodePath works as expected", async () => {
    const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:RepositoryModel" };
    const key2: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
    const key3: InstanceKey = { id: Id64.fromString("0x10"), className: "BisCore:DefinitionPartition" };
    const key4: InstanceKey = { id: Id64.fromString("0xe"), className: "BisCore:LinkPartition" };
    const keys: InstanceKey[][] = [[key1, key2, key3], [key1, key2, key4]];

    const result = await Presentation.presentation.getNodePaths({
      imodel,
      rulesetOrId: getNodePaths as Ruleset,
      instancePaths: keys,
      markedIndex: 1,
    });
    expect(result).to.not.be.undefined;
  });

  it("getFilteredNodePaths works as expected", async () => {
    const result = await Presentation.presentation.getFilteredNodePaths({
      imodel,
      rulesetOrId: getFilteredNodePaths as Ruleset,
      filterText: "filter",
    });
    expect(result).to.not.be.undefined;
  });

  it("getContentSources works as expected", async () => {
    const result = await Presentation.presentation.getContentSources({
      imodel,
      classes: [],
    });
    expect(result).to.not.be.undefined;
  });

  it("getContentDescriptor works as expected", async () => {
    const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
    const key2: InstanceKey = { id: Id64.fromString("0x17"), className: "BisCore:SpatialCategory" };
    const keys = new KeySet([key1, key2]);
    const descriptor = await Presentation.presentation.getContentDescriptor({
      imodel,
      rulesetOrId: getRelatedDistinctValues as Ruleset,
      displayType: "Grid",
      keys,
    });
    expect(descriptor).to.not.be.undefined;
  });

  it("getContentAndSize works as expected", async () => {
    const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
    const key2: InstanceKey = { id: Id64.fromString("0x17"), className: "BisCore:SpatialCategory" };
    const keys = new KeySet([key1, key2]);
    const contentAndSize = await Presentation.presentation.getContentAndSize({
      imodel,
      rulesetOrId: getRelatedDistinctValues as Ruleset,
      descriptor: {},
      keys,
    });
    expect(contentAndSize).to.not.be.undefined;
  });

  it("getContent works as expected", async () => {
    const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
    const key2: InstanceKey = { id: Id64.fromString("0x17"), className: "BisCore:SpatialCategory" };
    const keys = new KeySet([key1, key2]);
    const content = await Presentation.presentation.getContent({
      imodel,
      rulesetOrId: getRelatedDistinctValues as Ruleset,
      descriptor: {},
      keys,
    });
    expect(content).to.not.be.undefined;
  });

  it("getContentSetSize works as expected", async () => {
    const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
    const key2: InstanceKey = { id: Id64.fromString("0x17"), className: "BisCore:SpatialCategory" };
    const keys = new KeySet([key1, key2]);
    const contentSetSize = await Presentation.presentation.getContentSetSize({
      imodel,
      rulesetOrId: getRelatedDistinctValues as Ruleset,
      descriptor: {},
      keys,
    });
    expect(contentSetSize).to.not.be.undefined;
  });

  it("getElementProperties works as expected", async () => {
    const result = await Presentation.presentation.getElementProperties({
      imodel,
      elementId: "0x1",
    });
    expect(result).to.not.be.undefined;
  });

  it("getDisplayLabelDefinition works as expected", async () => {
    const displayLabel = await Presentation.presentation.getDisplayLabelDefinition({
      imodel,
      key: { id: Id64.fromString("0x1"), className: "BisCore:Subject" },
    });
    expect(displayLabel).to.not.be.undefined;
  });

  it("getDisplayLabelDefinitions works as expected", async () => {
    const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
    const key2: InstanceKey = { id: Id64.fromString("0x17"), className: "BisCore:SpatialCategory" };
    const displayLabels = await Presentation.presentation.getDisplayLabelDefinitions({
      imodel,
      keys: [key1, key2],
    });
    expect(displayLabels).to.not.be.undefined;
  });

  it("getSelectionScopes works as expected", async () => {
    const scopeIds = await Presentation.selection.scopes.getSelectionScopes(imodel);
    expect(scopeIds).to.not.be.undefined;
  });

  it("computeSelection works as expected", async () => {
    const computedSelections = await Presentation.selection.scopes.computeSelection(imodel, ["0x1"], "element");
    expect(computedSelections).to.not.be.undefined;
  });

});
