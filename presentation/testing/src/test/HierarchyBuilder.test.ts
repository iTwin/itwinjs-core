/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as moq from "typemoq";
import { expect } from "chai";
import { HierarchyBuilder, NodeMappingFunc } from "../HierarchyBuilder";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Node, NodeKey, Ruleset, RegisteredRuleset } from "@bentley/presentation-common";
import { PresentationManager, Presentation, RulesetManager } from "@bentley/presentation-frontend";
import { TreeNodeItem } from "@bentley/ui-components";
import { Guid } from "@bentley/bentleyjs-core";

async function getRootNodes() {
  const root: Node = {
    label: "Root Node",
    hasChildren: true,
    key: { type: "", pathFromRoot: ["root"] },
  };
  return [root];
}

async function getChildrenNodes({ }, parentKey: NodeKey) {
  if (parentKey.pathFromRoot[0] !== "root" || parentKey.pathFromRoot.length !== 1)
    return [];
  const child1: Node = {
    label: "Child 1",
    key: { type: "", pathFromRoot: ["root", "child1"] },
  };
  const child2: Node = {
    label: "Child 2",
    key: { type: "", pathFromRoot: ["root", "child2"] },
  };
  return [child1, child2];
}

describe("HierarchyBuilder", () => {
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const rulesetManagerMock = moq.Mock.ofType<RulesetManager>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const rulesetMock = moq.Mock.ofType<Ruleset>();

  beforeEach(() => {
    rulesetMock.setup((ruleset) => ruleset.id).returns(() => "1");
    rulesetManagerMock.setup(async (x) => x.add(moq.It.isAny())).returns(async (ruleset) => new RegisteredRuleset(ruleset, Guid.createValue(), () => { }));
    presentationManagerMock.setup((manager) => manager.rulesets()).returns(() => rulesetManagerMock.object);
  });

  afterEach(() => {
    presentationManagerMock.reset();
    rulesetMock.reset();
  });

  describe("createHierarchy", () => {
    context("without data", () => {
      beforeEach(() => {
        Presentation.presentation = presentationManagerMock.object;
        presentationManagerMock.setup(async (manager) => manager.getNodes(moq.It.isAny(), undefined)).returns(async () => []);
      });

      it("returns empty list when rulesetId is given", async () => {
        const builder = new HierarchyBuilder(imodelMock.object);
        const hierarchy = await builder.createHierarchy("1");
        expect(hierarchy).to.be.empty;
      });

      it("returns empty list when ruleset is given", async () => {
        const builder = new HierarchyBuilder(imodelMock.object);
        const hierarchy = await builder.createHierarchy(rulesetMock.object);
        expect(hierarchy).to.be.empty;
      });
    });

    context("with data", () => {
      beforeEach(() => {
        presentationManagerMock.setup(async (manager) => manager.getNodes(moq.It.isAny(), undefined)).returns(getRootNodes);
        presentationManagerMock.setup(async (manager) => manager.getNodes(moq.It.isAny(), moq.It.isAny())).returns(getChildrenNodes);
        Presentation.presentation = presentationManagerMock.object;
      });

      it("returns correct hierarchy", async () => {
        const builder = new HierarchyBuilder(imodelMock.object);
        expect(await builder.createHierarchy(rulesetMock.object)).to.matchSnapshot();
      });

      it("returns correct hierarchy with custom node mapping function", async () => {
        const nodeMapper: NodeMappingFunc = (node: TreeNodeItem) => ({ id: node.id });
        const builder = new HierarchyBuilder(imodelMock.object, nodeMapper);
        expect(await builder.createHierarchy(rulesetMock.object)).to.matchSnapshot();
      });
    });
  });
});
