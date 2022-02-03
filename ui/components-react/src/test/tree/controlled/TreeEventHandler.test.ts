/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { Subject } from "rxjs/internal/Subject";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { CheckBoxState } from "@itwin/core-react";
import type { TreeModelMutator } from "../../../components-react/tree/controlled/internal/TreeModelMutator";
import { from } from "../../../components-react/tree/controlled/Observable";
import type { TreeEventHandlerParams } from "../../../components-react/tree/controlled/TreeEventHandler";
import { TreeEventHandler } from "../../../components-react/tree/controlled/TreeEventHandler";
import type { CheckboxStateChange, TreeEvents, TreeSelectionChange } from "../../../components-react/tree/controlled/TreeEvents";
import type { MutableTreeModelNode, TreeModel } from "../../../components-react/tree/controlled/TreeModel";
import type { TreeModelSource } from "../../../components-react/tree/controlled/TreeModelSource";
import type { ITreeNodeLoader } from "../../../components-react/tree/controlled/TreeNodeLoader";
import { createRandomMutableTreeModelNode } from "./RandomTreeNodesHelpers";

describe("TreeEventHandler", () => {

  let eventHandler: TreeEventHandler;
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const treeNodeLoaderMock = moq.Mock.ofType<ITreeNodeLoader>();
  const treeEventsMock = moq.Mock.ofType<TreeEvents>();
  const treeModelMock = moq.Mock.ofType<TreeModel>();
  const params: TreeEventHandlerParams = {
    modelSource: modelSourceMock.object,
    nodeLoader: treeNodeLoaderMock.object,
  };

  let modelMutator: TreeModelMutator;
  let testNode: MutableTreeModelNode;

  beforeEach(() => {
    modelSourceMock.reset();
    treeEventsMock.reset();

    modelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
    testNode = createRandomMutableTreeModelNode();

    eventHandler = new TreeEventHandler(params);
    modelMutator = (eventHandler as any)._modelMutator;
  });

  describe("dispose", () => {

    it("calls next on disposed subject", () => {
      const subject: Subject<unknown> = (eventHandler as any)._disposed;
      const spy = sinon.spy(subject, "next");
      eventHandler.dispose();
      expect(spy).to.be.called;
    });

  });

  describe("modelSource", () => {

    it("returns modelSource", () => {
      expect(eventHandler.modelSource).to.be.deep.eq(modelSourceMock.object);
    });

  });

  describe("onNodeExpanded", () => {

    it("calls TreeMutator expandNode", () => {
      const spy = sinon.spy(modelMutator, "expandNode");
      eventHandler.onNodeExpanded({ nodeId: testNode.id });
      expect(spy).to.be.calledWith(testNode.id);
    });

  });

  describe("onNodeCollapsed", () => {

    it("calls TreeMutator collapseNode", () => {
      const spy = sinon.spy(modelMutator, "collapseNode");
      eventHandler.onNodeCollapsed({ nodeId: testNode.id });
      expect(spy).to.be.calledWith(testNode.id);
    });

  });

  describe("onSelectionModified", () => {

    it("calls TreeMutator modifySelection", () => {
      const change: TreeSelectionChange = {
        selectedNodeItems: [testNode.item],
        deselectedNodeItems: [],
      };
      const spy = sinon.spy(modelMutator, "modifySelection");
      eventHandler.onSelectionModified({ modifications: from([change]) });
      expect(spy).to.be.calledWith([testNode.item], []);
    });

  });

  describe("onSelectionReplaced", () => {

    it("calls TreeMutator replaceSelection on first value", () => {
      const change = {
        selectedNodeItems: [testNode.item],
      };
      const spy = sinon.spy(modelMutator, "replaceSelection");
      eventHandler.onSelectionReplaced({ replacements: from([change]) });
      expect(spy).to.be.calledWith([testNode.item]);
    });

    it("calls TreeMutator modifySelection on second value", () => {
      const change1 = {
        selectedNodeItems: [testNode.item],
      };
      const secondNode = createRandomMutableTreeModelNode();
      const change2 = {
        selectedNodeItems: [secondNode.item],
      };
      const replaceSpy = sinon.spy(modelMutator, "replaceSelection");
      const modifySpy = sinon.spy(modelMutator, "modifySelection");
      eventHandler.onSelectionReplaced({ replacements: from([change1, change2]) });
      expect(replaceSpy).to.be.calledWith(change1.selectedNodeItems);
      expect(modifySpy).to.be.calledWith(change2.selectedNodeItems, []);
    });

  });

  describe("onCheckboxStateChanged", () => {

    it("calls TreeMutator setCheckboxStates", () => {
      const changes: CheckboxStateChange[] = [{
        nodeItem: testNode.item,
        newState: CheckBoxState.On,
      }];
      const spy = sinon.spy(modelMutator, "setCheckboxStates");
      eventHandler.onCheckboxStateChanged({ stateChanges: from([changes]) });
      expect(spy).to.be.calledWith(changes);
    });

  });

  describe("onDelayedNodeClick", () => {

    it("calls TreeMutator activateEditing", () => {
      const onNodeUpdated = () => { };
      const eventHandlerWithEditing = new TreeEventHandler({ ...params, editingParams: { onNodeUpdated } });
      const modelMutatorWithEditing = (eventHandlerWithEditing as any)._modelMutator;
      const spy = sinon.spy(modelMutatorWithEditing, "activateEditing");
      eventHandlerWithEditing.onDelayedNodeClick({ nodeId: testNode.id });
      expect(spy).to.be.calledWith(testNode.id, onNodeUpdated);
    });

    it("does not call TreeMutator activateEditing if editing params are not set", () => {
      const spy = sinon.spy(modelMutator, "activateEditing");
      eventHandler.onDelayedNodeClick({ nodeId: testNode.id });
      expect(spy).to.not.be.called;
    });

  });

  describe("onNodeEditorActivated", () => {

    it("calls TreeMutator activateEditing", () => {
      const onNodeUpdated = () => { };
      const eventHandlerWithEditing = new TreeEventHandler({ ...params, editingParams: { onNodeUpdated } });
      const modelMutatorWithEditing = (eventHandlerWithEditing as any)._modelMutator;
      const spy = sinon.spy(modelMutatorWithEditing, "activateEditing");
      eventHandlerWithEditing.onNodeEditorActivated({ nodeId: testNode.id });
      expect(spy).to.be.calledWith(testNode.id, onNodeUpdated);
    });

    it("does not call TreeMutator activateEditing if editing params are not set", () => {
      const spy = sinon.spy(modelMutator, "activateEditing");
      eventHandler.onNodeEditorActivated({ nodeId: testNode.id });
      expect(spy).to.not.be.called;
    });

  });

});
