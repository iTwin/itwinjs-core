/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Guid } from "@itwin/core-bentley";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ChildNodeSpecificationTypes, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../IntegrationTests";

const RULESET: Ruleset = {
  id: "SimpleHierarchy",
  rules: [{
    ruleType: RuleTypes.RootNodes,
    specifications: [{
      specType: ChildNodeSpecificationTypes.CustomNode,
      type: "root",
      label: "root label",
      description: "root description",
      imageId: "root image id",
    }],
    customizationRules: [{
      ruleType: RuleTypes.CheckBox,
      defaultValue: true,
      isEnabled: false,
    }, {
      ruleType: RuleTypes.StyleOverride,
      foreColor: "\"Red\"",
      backColor: "\"Green\"",
      fontStyle: "\"Italic Bold\"",
    }],
  }, {
    ruleType: RuleTypes.ChildNodes,
    condition: "ParentNode.Type = \"root\"",
    specifications: [{
      specType: ChildNodeSpecificationTypes.CustomNode,
      type: "child",
      label: "child label",
      description: "child description",
      imageId: "child image id",
    }],
  }],
};

describe("TreeDataProvider", async () => {

  let imodel: IModelConnection;
  let provider: PresentationTreeDataProvider;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
    expect(imodel).is.not.null;
    provider = new PresentationTreeDataProvider({ imodel, ruleset: RULESET });
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  it("returns root nodes count", async () => {
    const count = await provider.getNodesCount();
    expect(count).to.eq(1);
  });

  it("returns root nodes", async () => {
    const nodes = await provider.getNodes();
    expect(nodes).to.matchSnapshot();
  });

  it("returns root nodes with paging", async () => {
    provider.pagingSize = 5;
    const nodes = await provider.getNodes(undefined, { start: 0, size: 5 });
    expect(nodes.length).to.eq(1);
    expect(nodes).to.matchSnapshot();
  });

  it("does not return root nodes with invalid paging", async () => {
    provider.pagingSize = 5;
    const nodes = await provider.getNodes(undefined, { start: 1, size: 5 });
    expect(nodes.length).to.eq(0);
  });

  it("returns child nodes count", async () => {
    const rootNodes = await provider.getNodes();
    const count = await provider.getNodesCount(rootNodes[0]);
    expect(count).to.eq(1);
  });

  it("returns child nodes", async () => {
    const rootNodes = await provider.getNodes();
    const childNodes = await provider.getNodes(rootNodes[0]);
    expect(childNodes).to.matchSnapshot();
  });

  it("returns child nodes with paging", async () => {
    const rootNodes = await provider.getNodes();
    provider.pagingSize = 5;
    const nodes = await provider.getNodes(rootNodes[0], { start: 0, size: 5 });
    expect(nodes.length).to.eq(1);
    expect(nodes).to.matchSnapshot();
  });

  it("does not return child nodes with invalid paging", async () => {
    const rootNodes = await provider.getNodes();
    provider.pagingSize = 5;
    const nodes = await provider.getNodes(rootNodes[0], { start: 1, size: 5 });
    expect(nodes.length).to.eq(0);
  });

  it("requests backend only once to get first page", async () => {
    const getNodesSpy = sinon.spy(Presentation.presentation.rpcRequestsHandler, "getPagedNodes");
    provider.pagingSize = 10;

    // request count and first page
    const count = await provider.getNodesCount();
    const nodes = await provider.getNodes(undefined, { start: 0, size: 10 });

    expect(count).to.not.eq(0);
    expect(nodes).to.not.be.undefined;
    expect(getNodesSpy).to.be.calledOnce;
  });

  it("shows grouping node children counts", async () => {
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [{
        ruleType: RuleTypes.RootNodes,
        specifications: [{
          specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
          classes: { schemaName: "BisCore", classNames: ["Model"] },
          arePolymorphic: true,
          groupByLabel: true,
        }],
      }],
    };
    provider = new PresentationTreeDataProvider({ imodel, ruleset, appendChildrenCountForGroupingNodes: true });

    const nodes = await provider.getNodes(undefined);
    expect(nodes).to.matchSnapshot();
  });

});
