/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { BeEvent } from "@bentley/bentleyjs-core";
import { PropertyRecord } from "@bentley/ui-abstract";
import { MutableTreeModel, TreeModelNodeInput, VisibleTreeNodes } from "../../../ui-components/tree/controlled/TreeModel";
import { TreeModelSource } from "../../../ui-components/tree/controlled/TreeModelSource";
import { ITreeDataProvider, TreeDataChangesListener } from "../../../ui-components/tree/TreeDataProvider";
import TestUtils from "../../TestUtils";

describe("TreeModelSource", () => {
  let modelSource: TreeModelSource;
  const dataProviderMock = moq.Mock.ofType<ITreeDataProvider>();
  const mutableTreeModelMock = moq.Mock.ofType<MutableTreeModel>();
  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();

  let onTreeNodeChanged: BeEvent<TreeDataChangesListener>;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    dataProviderMock.reset();
    mutableTreeModelMock.reset();

    onTreeNodeChanged = new BeEvent<TreeDataChangesListener>();
    // eslint-disable-next-line deprecation/deprecation
    dataProviderMock.setup((x) => x.onTreeNodeChanged).returns(() => onTreeNodeChanged);
    modelSource = new TreeModelSource();
  });

  describe("constructor", () => {
    it("listens for onModelChanged events", () => {
      (modelSource as any)._model = mutableTreeModelMock.object;
      mutableTreeModelMock.setup((x) => x.computeVisibleNodes()).returns(() => visibleNodesMock.object).verifiable(moq.Times.exactly(2));
      modelSource.getVisibleNodes();
      modelSource.onModelChanged.emit([mutableTreeModelMock.object, { addedNodeIds: [], modifiedNodeIds: [], removedNodeIds: [] }]);
      modelSource.getVisibleNodes();
      mutableTreeModelMock.verifyAll();
    });
  });

  describe("modifyModel", () => {
    beforeEach(() => {
      const root1Input: TreeModelNodeInput = {
        id: "root1",
        isExpanded: false,
        item: { id: "root1_item", label: PropertyRecord.fromString("test_label", "label") },
        label: PropertyRecord.fromString("test_label", "label"),
        isLoading: false,
        isSelected: false,
      };

      modelSource.modifyModel((model) => { model.setChildren(undefined, [root1Input], 0); });
    });

    it("does not emit onModelChanged event if model did not change", () => {
      const spy = sinon.spy(modelSource.onModelChanged, "emit");
      modelSource.modifyModel(() => { });
      expect(spy).to.not.be.called;
    });

    it("emits onModelChanged event with added node id", () => {
      const root2Input: TreeModelNodeInput = {
        id: "root2",
        isExpanded: false,
        item: { id: "root2_item", label: PropertyRecord.fromString("test_label", "label") },
        label: PropertyRecord.fromString("test_label", "label"),
        isLoading: false,
        isSelected: false,
      };
      const spy = sinon.spy(modelSource.onModelChanged, "emit");
      modelSource.modifyModel((model) => { model.setChildren(undefined, [root2Input], 1); });
      expect(spy).to.be.called;
      const changes = spy.args[0][0][1];
      expect(changes.addedNodeIds.length).to.be.eq(1);
      expect(changes.addedNodeIds[0]).to.be.eq(root2Input.id);
    });

    it("emits onModelChanged event with removed node id", () => {
      const spy = sinon.spy(modelSource.onModelChanged, "emit");
      modelSource.modifyModel((model) => { model.clearChildren(undefined); });
      expect(spy).to.be.called;
      const changes = spy.args[0][0][1];
      expect(changes.removedNodeIds.length).to.be.eq(1);
      expect(changes.removedNodeIds[0]).to.be.eq("root1");
    });

    it("emits onModelChanged event with modified node id", () => {
      const spy = sinon.spy(modelSource.onModelChanged, "emit");
      modelSource.modifyModel((model) => {
        const node = model.getNode("root1");
        node!.isSelected = !node!.isSelected;
      });
      expect(spy).to.be.called;
      const changes = spy.args[0][0][1];
      expect(changes.modifiedNodeIds.length).to.be.eq(1);
      expect(changes.modifiedNodeIds[0]).to.be.eq("root1");
    });

    it("clears model and adds new nodes", () => {
      modelSource.modifyModel((model) => {
        model.clearChildren(undefined);
      });
      expect(modelSource.getVisibleNodes().getNumNodes()).to.be.eq(0);
      const newRoot1Input: TreeModelNodeInput = {
        id: "new_root1",
        isExpanded: false,
        item: { id: "root1_item", label: PropertyRecord.fromString("test_label", "label") },
        label: PropertyRecord.fromString("test_label", "label"),
        isLoading: false,
        isSelected: false,
      };
      modelSource.modifyModel((model) => {
        model.setChildren(undefined, [newRoot1Input], 0);
      });
      expect(modelSource.getVisibleNodes().getNumNodes()).to.be.eq(1);
    });

    it("overrides existing children multiple times", () => {
      const newRoot1Input: TreeModelNodeInput = {
        id: "new_root1",
        isExpanded: false,
        item: { id: "root1_item", label: PropertyRecord.fromString("test_label", "label") },
        label: PropertyRecord.fromString("test_label", "label"),
        isLoading: false,
        isSelected: false,
      };;
      modelSource.modifyModel((model) => {
        model.setNumChildren(undefined, 1);
        model.setChildren(undefined, [newRoot1Input], 0);
      });
      modelSource.modifyModel((model) => {
        model.setNumChildren(undefined, 1);
        model.setChildren(undefined, [{ ...newRoot1Input, id: "root1" }], 0);
      });
    });
  });

  describe("getModel", () => {
    it("returns model", () => {
      (modelSource as any)._model = mutableTreeModelMock.object;
      const model = modelSource.getModel();
      expect(model).to.be.eq(mutableTreeModelMock.object);
    });
  });

  describe("getVisibleNodes", () => {
    beforeEach(() => {
      (modelSource as any)._model = mutableTreeModelMock.object;
    });

    it("computes visible nodes", () => {
      mutableTreeModelMock.setup((x) => x.computeVisibleNodes()).returns(() => visibleNodesMock.object).verifiable(moq.Times.once());
      modelSource.getVisibleNodes();
      mutableTreeModelMock.verifyAll();
    });

    it("does not compute visible nodes second time", () => {
      mutableTreeModelMock.setup((x) => x.computeVisibleNodes()).returns(() => visibleNodesMock.object).verifiable(moq.Times.once());
      modelSource.getVisibleNodes();
      modelSource.getVisibleNodes();
      mutableTreeModelMock.verifyAll();
    });
  });
});
