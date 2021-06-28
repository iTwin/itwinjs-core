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

describe("VisibilityTreeEventHandler", () => {

  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const modelMock = moq.Mock.ofType<TreeModel>();
  const nodeLoaderMock = moq.Mock.ofType<AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  const selectionHandlerMock = moq.Mock.ofType<SelectionHandler>();

  const changeVisibility = sinon.fake();
  const getVisibilityStatus = sinon.spy();
  const dispose = sinon.fake();
  const onVisibilityChange = new BeEvent<VisibilityChangeListener>();

  const visibilityHandler: IVisibilityHandler = {
    changeVisibility,
    getVisibilityStatus,
    onVisibilityChange,
    dispose,
  };

  beforeEach(async () => {
    modelSourceMock.reset();
    nodeLoaderMock.reset();
    dataProviderMock.reset();
    selectionHandlerMock.reset();
    changeVisibility.resetHistory();
    getVisibilityStatus.resetHistory();
    dispose.resetHistory();

    modelMock.setup((x) => x.getNode(moq.It.isAny())).returns(() => moq.Mock.ofType<TreeModelNode>().object);
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

    it("doesn't call getVisibilityStatus() when onChangeVisibility event is raised with visibilityStatus", async () => {
      const testVisibilityStatus: VisibilityStatus = {
        state: "visible",
        isDisabled: false,
      };

      const visibilityStatus: Map<string, VisibilityStatus> = new Map([
        ["testId", testVisibilityStatus],
      ]);

      using(createHandler({ visibilityHandler }), (_) => {
        onVisibilityChange.raiseEvent(undefined, visibilityStatus);
        expect(getVisibilityStatus.notCalled).to.be.true;
      });
    });

    it("calls getVisibilityStatus() when onChangeVisibility event is raised with nodeIds", async () => {
      using(createHandler({ visibilityHandler }), (_) => {
        onVisibilityChange.raiseEvent(["testId"]);
        expect(getVisibilityStatus.called).to.be.true;
      });
    });

  });
});
