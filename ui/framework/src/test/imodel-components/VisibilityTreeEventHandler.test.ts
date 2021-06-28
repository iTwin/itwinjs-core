/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { BeEvent, BeUiEvent, using } from "@bentley/bentleyjs-core";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { IVisibilityHandler, VisibilityChangeListener, VisibilityStatus, VisibilityTreeEventHandler, VisibilityTreeEventHandlerParams } from "../../ui-framework/imodel-components/VisibilityTreeEventHandler";
import { AbstractTreeNodeLoaderWithProvider, TreeModel, TreeModelChanges, TreeModelNode, TreeModelSource } from "@bentley/ui-components";
import { SelectionHandler } from "@bentley/presentation-frontend";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { createSimpleTreeModelNode } from "./Common";
import TestUtils from "../TestUtils";

describe("VisibilityTreeEventHandler", () => {

  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const modelMock = moq.Mock.ofType<TreeModel>();
  const nodeLoaderMock = moq.Mock.ofType<AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  const selectionHandlerMock = moq.Mock.ofType<SelectionHandler>();

  const changeVisibility = sinon.fake();
  const getVisibilityStatus = sinon.stub();
  const dispose = sinon.fake();
  const onVisibilityChange = new BeEvent<VisibilityChangeListener>();

  const visibilityHandler: IVisibilityHandler = {
    changeVisibility,
    getVisibilityStatus,
    onVisibilityChange,
    dispose,
  };

  const testVisibilityStatus: VisibilityStatus = {
    state: "visible",
    isDisabled: false,
  };

  beforeEach(async () => {
    modelSourceMock.reset();
    modelMock.reset();
    nodeLoaderMock.reset();
    dataProviderMock.reset();
    selectionHandlerMock.reset();
    changeVisibility.resetHistory();
    getVisibilityStatus.reset();
    dispose.resetHistory();

    getVisibilityStatus.returns(testVisibilityStatus);
    modelMock.setup((x) => x.getNode(moq.It.isAny())).returns(() => createSimpleTreeModelNode());
    modelSourceMock.setup((x) => x.onModelChanged).returns(() => new BeUiEvent<[TreeModel, TreeModelChanges]>());
    modelSourceMock.setup((x) => x.getModel()).returns(() => modelMock.object);
    nodeLoaderMock.setup((x) => x.dataProvider).returns(() => dataProviderMock.object);
    nodeLoaderMock.setup((x) => x.modelSource).returns(() => modelSourceMock.object);
  });

  const createHandler = (partialProps?: Partial<VisibilityTreeEventHandlerParams>): VisibilityTreeEventHandler => {
    if (!partialProps)
      partialProps = {};
    const props: VisibilityTreeEventHandlerParams = {
      visibilityHandler: partialProps.visibilityHandler || undefined,
      nodeLoader: partialProps.nodeLoader || nodeLoaderMock.object,
      selectionHandler: partialProps.selectionHandler || selectionHandlerMock.object,
    };
    return new VisibilityTreeEventHandler(props);
  };

  describe("onChangeVisibility", () => {
    it("calls getVisibilityStatus() only on the nodes, whose visibility status is not known when onChangeVisibility event is raised with only visibilityStatus", async () => {
      const visibilityStatus: Map<string, VisibilityStatus> = new Map([
        ["testId2", testVisibilityStatus],
      ]);

      const treeModelNodes = [
        createSimpleTreeModelNode("testId1"),
        createSimpleTreeModelNode("testId2"),
        createSimpleTreeModelNode("testId3"),
      ];

      modelMock.setup((x) => x.iterateTreeModelNodes()).returns(() => treeModelNodes[Symbol.iterator]());

      await using(createHandler({ visibilityHandler }), async (_) => {
        onVisibilityChange.raiseEvent(undefined, visibilityStatus);
      });
      await TestUtils.flushAsyncOperations();

      // getVisibilityStatus() is called 3 times from VisibilityTreeEventHandler constructor and 2 times by raising onVisibilityChange event.
      expect(getVisibilityStatus.callCount).to.eq(5);
    });

    it("calls getVisibilityStatus() when onChangeVisibility event is raised with only nodeIds", async () => {
      await using(createHandler({ visibilityHandler }), async (_) => {
        onVisibilityChange.raiseEvent(["testId1", "testId2"]);
      });
      expect(getVisibilityStatus.callCount).to.eq(2);
    });

    it("calls getVisibilityStatus() only on the nodes, whose visibilityStatus is not known", async () => {
      const visibilityStatus: Map<string, VisibilityStatus> = new Map([
        ["testId1", testVisibilityStatus],
      ]);

      const node1 = createSimpleTreeModelNode("testId1");
      const node2 = createSimpleTreeModelNode("testId2");

      modelMock.reset();
      modelMock.setup((x) => x.getNode("testId1")).returns(() => node1);
      modelMock.setup((x) => x.getNode("testId2")).returns(() => node2);

      await using(createHandler({ visibilityHandler }), async (_) => {
        onVisibilityChange.raiseEvent(["testId1", "testId2"], visibilityStatus);
      });
      expect(getVisibilityStatus.callCount).to.eq(1);
    });

  });
});
