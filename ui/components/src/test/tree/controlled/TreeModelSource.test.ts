/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import sinon from "sinon";
import * as faker from "faker";
import { BeEvent } from "@bentley/bentleyjs-core";
import { TreeModelSource } from "../../../ui-components/tree/controlled/TreeModelSource";
import { ITreeDataProvider, TreeDataChangesListener } from "../../../ui-components/tree/TreeDataProvider";
import { TreeModelNodeInput, MutableTreeModel, VisibleTreeNodes } from "../../../ui-components/tree/controlled/TreeModel";

describe("TreeModelSource", () => {

  let modelSource: TreeModelSource;
  const dataProviderMock = moq.Mock.ofType<ITreeDataProvider>();
  const mutableTreeModelMock = moq.Mock.ofType<MutableTreeModel>();
  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();

  let onTreeNodeChanged: BeEvent<TreeDataChangesListener>;

  beforeEach(() => {
    dataProviderMock.reset();
    mutableTreeModelMock.reset();

    onTreeNodeChanged = new BeEvent<TreeDataChangesListener>();
    dataProviderMock.setup((x) => x.onTreeNodeChanged).returns(() => onTreeNodeChanged);
    modelSource = new TreeModelSource();
  });

  describe("constructor", () => {

    it("listens for onModelChanged events", () => {
      (modelSource as any)._model = mutableTreeModelMock.object;
      mutableTreeModelMock.setup((x) => x.computeVisibleNodes()).returns(() => visibleNodesMock.object).verifiable(moq.Times.exactly(2));
      modelSource.getVisibleNodes();
      modelSource.onModelChanged.emit(mutableTreeModelMock.object);
      modelSource.getVisibleNodes();
      mutableTreeModelMock.verifyAll();
    });

  });

  describe("modifyModel", () => {

    it("does not emit onModelChanged event if model did not change", () => {
      const spy = sinon.spy(modelSource.onModelChanged, "emit");
      modelSource.modifyModel(() => { });
      expect(spy).to.not.be.called;
    });

    it("emits onModelChanged event if model has changed", () => {
      const input: TreeModelNodeInput = {
        id: faker.random.uuid(),
        isExpanded: faker.random.boolean(),
        item: { id: faker.random.uuid(), label: faker.random.word() },
        label: faker.random.word(),
        isLoading: faker.random.boolean(),
        isSelected: faker.random.boolean(),
      };
      const spy = sinon.spy(modelSource.onModelChanged, "emit");
      modelSource.modifyModel((model) => { model.setChildren(undefined, [input], 0); });
      expect(spy).to.be.called;
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
