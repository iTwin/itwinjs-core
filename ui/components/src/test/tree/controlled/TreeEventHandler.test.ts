/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import * as sinon from "sinon";
import * as faker from "faker";
import { Subject } from "rxjs/internal/Subject";
import { CheckBoxState } from "@bentley/ui-core";
import { TreeEventHandler, TreeEventHandlerParams } from "../../../ui-components/tree/controlled/TreeEventHandler";
import { TreeModelSource } from "../../../ui-components/tree/controlled/TreeModelSource";
import { TreeEvents, TreeSelectionChange, CheckboxStateChange } from "../../../ui-components/tree/controlled/TreeEvents";
import { from } from "../../../ui-components/tree/controlled/Observable";
import { TreeModelMutator } from "../../../ui-components/tree/controlled/internal/TreeModelMutator";
import { ITreeNodeLoader } from "../../../ui-components/tree/controlled/TreeNodeLoader";
import { TreeModel } from "../../../ui-components/tree/controlled/TreeModel";

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
  let testNodeId: string;

  beforeEach(() => {
    modelSourceMock.reset();
    treeEventsMock.reset();

    modelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
    testNodeId = faker.random.uuid();

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

  describe("onNodeExpanded", () => {

    it("calls TreeMutator expandNode", () => {
      const spy = sinon.spy(modelMutator, "expandNode");
      eventHandler.onNodeExpanded({ nodeId: testNodeId });
      expect(spy).to.be.calledWith(testNodeId);
    });

  });

  describe("onNodeCollapsed", () => {

    it("calls TreeMutator collapseNode", () => {
      const spy = sinon.spy(modelMutator, "collapseNode");
      eventHandler.onNodeCollapsed({ nodeId: testNodeId });
      expect(spy).to.be.calledWith(testNodeId);
    });

  });

  describe("onSelectionModified", () => {

    it("calls TreeMutator modifySelection", () => {
      const change: TreeSelectionChange = {
        selectedNodeIds: [testNodeId],
        deselectedNodeIds: [],
      };
      const spy = sinon.spy(modelMutator, "modifySelection");
      eventHandler.onSelectionModified({ modifications: from([change]) });
      expect(spy).to.be.calledWith([testNodeId], []);
    });

  });

  describe("onSelectionReplaced", () => {

    it("calls TreeMutator replaceSelection on first value", () => {
      const change = {
        selectedNodeIds: [testNodeId],
      };
      const spy = sinon.spy(modelMutator, "replaceSelection");
      eventHandler.onSelectionReplaced({ replacements: from([change]) });
      expect(spy).to.be.calledWith([testNodeId]);
    });

    it("calls TreeMutator modifySelection on second value", () => {
      const change1 = {
        selectedNodeIds: [testNodeId],
      };
      const change2 = {
        selectedNodeIds: [faker.random.uuid()],
      };
      const replaceSpy = sinon.spy(modelMutator, "replaceSelection");
      const modifySpy = sinon.spy(modelMutator, "modifySelection");
      eventHandler.onSelectionReplaced({ replacements: from([change1, change2]) });
      expect(replaceSpy).to.be.calledWith(change1.selectedNodeIds);
      expect(modifySpy).to.be.calledWith(change2.selectedNodeIds, []);
    });

  });

  describe("onCheckboxStateChanged", () => {

    it("calls TreeMutator setCheckboxStates", () => {
      const changes: CheckboxStateChange[] = [{
        nodeId: testNodeId,
        newState: CheckBoxState.On,
      }];
      const spy = sinon.spy(modelMutator, "setCheckboxStates");
      eventHandler.onCheckboxStateChanged({ stateChanges: from([changes]) });
      expect(spy).to.be.calledWith(changes);
    });

  });

});
