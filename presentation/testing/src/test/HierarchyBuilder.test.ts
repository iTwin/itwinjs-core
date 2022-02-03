/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { BeEvent, Guid } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyRequestOptions, Node, NodeKey, Ruleset } from "@itwin/presentation-common";
import { LabelDefinition, RegisteredRuleset } from "@itwin/presentation-common";
import type { PresentationManager, RulesetManager, RulesetVariablesManager } from "@itwin/presentation-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import type { TreeNodeItem } from "@itwin/components-react";
import type { NodeMappingFunc } from "../presentation-testing/HierarchyBuilder";
import { HierarchyBuilder } from "../presentation-testing/HierarchyBuilder";

async function getRootNodes() {
  const root: Node = {
    label: LabelDefinition.fromLabelString("Root Node"),
    hasChildren: true,
    key: { type: "", version: 0, pathFromRoot: ["root"] },
  };
  return { nodes: [root], count: 1 };
}

async function getChildrenNodes(opts: HierarchyRequestOptions<IModelConnection, NodeKey>) {
  if (opts.parentKey?.pathFromRoot[0] !== "root" || opts?.parentKey.pathFromRoot.length !== 1)
    return { nodes: [], count: 0 };

  const child1: Node = {
    label: LabelDefinition.fromLabelString("Child 1"),
    key: { type: "", version: 0, pathFromRoot: ["root", "child1"] },
  };
  const child2: Node = {
    label: LabelDefinition.fromLabelString("Child 2"),
    key: { type: "", version: 0, pathFromRoot: ["root", "child2"] },
  };
  return { nodes: [child1, child2], count: 2 };
}

describe("HierarchyBuilder", () => {
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const rulesetVariablesManagerMock = moq.Mock.ofType<RulesetVariablesManager>();
  const rulesetManagerMock = moq.Mock.ofType<RulesetManager>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const rulesetMock = moq.Mock.ofType<Ruleset>();

  beforeEach(() => {
    rulesetMock.setup((ruleset) => ruleset.id).returns(() => "1");
    rulesetManagerMock.setup(async (x) => x.add(moq.It.isAny())).returns(async (ruleset) => new RegisteredRuleset(ruleset, Guid.createValue(), () => { }));
    rulesetVariablesManagerMock.setup((x) => x.onVariableChanged).returns(() => new BeEvent());
    presentationManagerMock.setup((manager) => manager.rulesets()).returns(() => rulesetManagerMock.object);
    presentationManagerMock.setup((manager) => manager.vars(moq.It.isAny())).returns(() => rulesetVariablesManagerMock.object);
  });

  afterEach(() => {
    presentationManagerMock.reset();
    rulesetVariablesManagerMock.reset();
    rulesetMock.reset();
  });

  describe("createHierarchy", () => {
    context("without data", () => {
      beforeEach(() => {
        Presentation.setPresentationManager(presentationManagerMock.object);
        presentationManagerMock.setup(async (manager) => manager.getNodesAndCount(moq.It.isAny())).returns(async () => ({ nodes: [], count: 0 }));
      });

      it("returns empty list when rulesetId is given", async () => {
        const builder = new HierarchyBuilder({ imodel: imodelMock.object });
        const hierarchy = await builder.createHierarchy("1");
        expect(hierarchy).to.be.empty;
      });

      it("returns empty list when ruleset is given", async () => {
        const builder = new HierarchyBuilder({ imodel: imodelMock.object });
        const hierarchy = await builder.createHierarchy(rulesetMock.object);
        expect(hierarchy).to.be.empty;
      });
    });

    context("with data", () => {
      beforeEach(() => {
        presentationManagerMock.setup(async (manager) => manager.getNodesAndCount(moq.It.is((opts) => opts.parentKey === undefined))).returns(getRootNodes);
        presentationManagerMock.setup(async (manager) => manager.getNodesAndCount(moq.It.is((opts) => opts.parentKey !== undefined))).returns(getChildrenNodes);
        Presentation.setPresentationManager(presentationManagerMock.object);
      });

      it("returns correct hierarchy", async () => {
        const builder = new HierarchyBuilder({ imodel: imodelMock.object });
        expect(await builder.createHierarchy(rulesetMock.object)).to.matchSnapshot();
      });

      it("returns correct hierarchy with custom node mapping function", async () => {
        const nodeMapper: NodeMappingFunc = (node: TreeNodeItem) => ({ id: node.id });
        const builder = new HierarchyBuilder({ imodel: imodelMock.object, nodeMappingFunc: nodeMapper });
        expect(await builder.createHierarchy(rulesetMock.object)).to.matchSnapshot();
      });
    });
  });
});
