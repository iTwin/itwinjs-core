/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import deepEqual from "deep-equal";
import * as sinon from "sinon";
import { IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { ChildNodeSpecificationTypes, Node, NodeKey, PartialHierarchyModification, RuleTypes } from "@bentley/presentation-common";
import { LabelDefinitionJSON } from "@bentley/presentation-common/lib/presentation-common/LabelDefinition"; // tslint:disable-line: no-direct-imports
import { Presentation } from "@bentley/presentation-frontend";
import { initialize, terminate } from "../IntegrationTests";

describe("Update", () => {

  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("on ruleset modification", async () => {

    const listener = sinon.spy();

    beforeEach(() => {
      listener.resetHistory();
      Presentation.presentation.onHierarchyUpdate.addListener(listener);
    });

    afterEach(() => {
      Presentation.presentation.onHierarchyUpdate.removeListener(listener);
    });

    it("detects custom node change", async () => {
      const initialRuleset = await Presentation.presentation.rulesets().add({
        id: "test",
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.CustomNode,
            type: "T_NODE",
            label: "test-1",
          }],
        }],
      });
      expect(initialRuleset).to.not.be.undefined;
      const initialNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: initialRuleset });
      expect(initialNodes.length).to.eq(1);
      expect(initialNodes[0].label.displayValue).to.eq("test-1");

      const modifiedRuleset = await Presentation.presentation.rulesets().modify(initialRuleset, {
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.CustomNode,
            type: "T_NODE",
            label: "test-2",
          }],
        }],
      });
      expect(modifiedRuleset).to.not.be.undefined;

      const expectedChanges: PartialHierarchyModification[] = [{
        type: "Update",
        node: sinon.match((n: Node) => n.key.type === "T_NODE" && n.label.displayValue === "test-2") as any,
        changes: sinon.match((changes: Array<{ name: string, old: unknown, new: unknown }>) =>
          changes.length === 2
          && changes.some((change) => change.name === "Key")
          && changes.some((change) => change.name === "LabelDefinition" && (change.old as LabelDefinitionJSON).displayValue === "test-1" && (change.new as LabelDefinitionJSON).displayValue === "test-2"),
        ) as any,
      }];
      expect(listener).to.be.calledOnce;
      expect(listener.firstCall).to.be.calledWith(modifiedRuleset, expectedChanges);
    });

    it("detects ECInstance node change", async () => {
      const initialRuleset = await Presentation.presentation.rulesets().add({
        id: "test",
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
            groupByClass: false,
            groupByLabel: false,
          }],
        }],
      });
      expect(initialRuleset).to.not.be.undefined;
      const initialNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: initialRuleset });
      expect(initialNodes.length).to.eq(2);
      expect(initialNodes[0].label.displayValue).to.eq("Physical Object [0-38]");
      expect(initialNodes[1].label.displayValue).to.eq("Physical Object [0-39]");

      const modifiedRuleset = await Presentation.presentation.rulesets().modify(initialRuleset, {
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
            instanceFilter: `this.ECInstanceId = ${parseInt("0x75", 16)}`,
            groupByClass: false,
            groupByLabel: false,
          }],
        }],
      });
      expect(modifiedRuleset).to.not.be.undefined;

      const expectedChanges: PartialHierarchyModification[] = [{
        type: "Delete",
        node: initialNodes[0],
      }, {
        type: "Update",
        node: sinon.match((node) => NodeKey.isInstancesNodeKey(node.key) && NodeKey.isInstancesNodeKey(initialNodes[1].key) && deepEqual(node.key.instanceKeys, initialNodes[1].key.instanceKeys)) as any,
        changes: [{
          name: "Key",
          old: initialNodes[1].key,
          new: sinon.match((key) => NodeKey.isInstancesNodeKey(key) && NodeKey.isInstancesNodeKey(initialNodes[1].key) && deepEqual(key.instanceKeys, initialNodes[1].key.instanceKeys)) as any,
        }],
      }];
      expect(listener).to.be.calledOnce;
      expect(listener.firstCall).to.be.calledWith(modifiedRuleset, expectedChanges);
    });

    it("detects ECClass grouping node change", async () => {
      const initialRuleset = await Presentation.presentation.rulesets().add({
        id: "test",
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
            instanceFilter: `this.ECInstanceId = ${parseInt("0x74", 16)}`,
            groupByClass: true,
            groupByLabel: false,
          }],
        }],
      });
      expect(initialRuleset).to.not.be.undefined;
      const initialNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: initialRuleset });
      expect(initialNodes.length).to.eq(1);
      expect(NodeKey.isClassGroupingNodeKey(initialNodes[0].key)).to.be.true;
      expect(initialNodes[0].label.displayValue).to.eq("Physical Object");

      const modifiedRuleset = await Presentation.presentation.rulesets().modify(initialRuleset, {
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
            instanceFilter: `this.ECInstanceId = ${parseInt("0x75", 16)}`,
            groupByClass: true,
            groupByLabel: false,
          }],
        }],
      });
      expect(modifiedRuleset).to.not.be.undefined;

      const expectedChanges: PartialHierarchyModification[] = [{
        type: "Update",
        node: sinon.match((node) => NodeKey.isClassGroupingNodeKey(node.key) && node.label.displayValue === "Physical Object") as any,
        changes: [sinon.match({
          name: "Key",
        }) as any],
      }, {
        type: "Insert",
        position: 0,
        node: sinon.match((node: Node) => NodeKey.isInstancesNodeKey(node.key) && node.key.instanceKeys.some((k) => k.id === "0x75")) as any,
      }];
      expect(listener).to.be.calledOnce;
      expect(listener.firstCall).to.be.calledWith(modifiedRuleset, expectedChanges);
    });

  });

});
