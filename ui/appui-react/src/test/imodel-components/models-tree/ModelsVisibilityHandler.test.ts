/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import { BeEvent, Id64String, using } from "@itwin/core-bentley";
import { QueryRowFormat } from "@itwin/core-common";
import {
  IModelApp, IModelConnection, NoRenderApp, PerModelCategoryVisibility, SpatialViewState, Viewport, ViewState, ViewState3d,
} from "@itwin/core-frontend";
import { isPromiseLike } from "@itwin/core-react";
import { createRandomId } from "@itwin/presentation-common/lib/cjs/test";
import { FilteredPresentationTreeDataProvider } from "@itwin/presentation-components";
import { IModelHierarchyChangeEventArgs, Presentation, PresentationManager } from "@itwin/presentation-frontend";
import { ModelsVisibilityHandler, ModelsVisibilityHandlerProps } from "../../../appui-react/imodel-components/models-tree/ModelsVisibilityHandler";
import { TestUtils } from "../../TestUtils";
import { createCategoryNode, createElementClassGroupingNode, createElementNode, createModelNode, createSubjectNode } from "../Common";

describe("ModelsVisibilityHandler", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    await NoRenderApp.startup();
  });

  after(async () => {
    TestUtils.terminateUiFramework();
    await IModelApp.shutdown();
  });

  const imodelMock = moq.Mock.ofType<IModelConnection>();

  beforeEach(() => {
    imodelMock.reset();
  });

  interface ViewportMockProps {
    viewState?: ViewState;
    perModelCategoryVisibility?: PerModelCategoryVisibility.Overrides;
    onViewedCategoriesPerModelChanged?: BeEvent<(vp: Viewport) => void>;
    onViewedCategoriesChanged?: BeEvent<(vp: Viewport) => void>;
    onViewedModelsChanged?: BeEvent<(vp: Viewport) => void>;
    onAlwaysDrawnChanged?: BeEvent<() => void>;
    onNeverDrawnChanged?: BeEvent<() => void>;
  }

  const mockViewport = (props?: ViewportMockProps) => {
    if (!props)
      props = {};
    if (!props.viewState)
      props.viewState = moq.Mock.ofType<ViewState>().object;
    if (!props.perModelCategoryVisibility)
      props.perModelCategoryVisibility = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>().object;
    if (!props.onViewedCategoriesPerModelChanged)
      props.onViewedCategoriesPerModelChanged = new BeEvent<(vp: Viewport) => void>();
    if (!props.onViewedCategoriesChanged)
      props.onViewedCategoriesChanged = new BeEvent<(vp: Viewport) => void>();
    if (!props.onViewedModelsChanged)
      props.onViewedModelsChanged = new BeEvent<(vp: Viewport) => void>();
    if (!props.onAlwaysDrawnChanged)
      props.onAlwaysDrawnChanged = new BeEvent<() => void>();
    if (!props.onNeverDrawnChanged)
      props.onNeverDrawnChanged = new BeEvent<() => void>();
    const vpMock = moq.Mock.ofType<Viewport>();
    vpMock.setup((x) => x.iModel).returns(() => imodelMock.object);
    vpMock.setup((x) => x.view).returns(() => props!.viewState!);
    vpMock.setup((x) => x.perModelCategoryVisibility).returns(() => props!.perModelCategoryVisibility!);
    vpMock.setup((x) => x.onViewedCategoriesPerModelChanged).returns(() => props!.onViewedCategoriesPerModelChanged!);
    vpMock.setup((x) => x.onViewedCategoriesChanged).returns(() => props!.onViewedCategoriesChanged!);
    vpMock.setup((x) => x.onViewedModelsChanged).returns(() => props!.onViewedModelsChanged!);
    vpMock.setup((x) => x.onAlwaysDrawnChanged).returns(() => props!.onAlwaysDrawnChanged!);
    vpMock.setup((x) => x.onNeverDrawnChanged).returns(() => props!.onNeverDrawnChanged!);
    return vpMock;
  };

  const createHandler = (partialProps?: Partial<ModelsVisibilityHandlerProps>): ModelsVisibilityHandler => {
    if (!partialProps)
      partialProps = {};
    const props: ModelsVisibilityHandlerProps = {
      rulesetId: "test",
      viewport: partialProps.viewport || mockViewport().object,
      hierarchyAutoUpdateEnabled: partialProps.hierarchyAutoUpdateEnabled,
    };
    return new ModelsVisibilityHandler(props);
  };

  interface SubjectModelIdsMockProps {
    imodelMock: moq.IMock<IModelConnection>;
    subjectsHierarchy: Map<Id64String, Id64String[]>;
    subjectModels: Map<Id64String, Array<{ id: Id64String, content?: string }>>;
  }

  const mockSubjectModelIds = (props: SubjectModelIdsMockProps) => {
    props.imodelMock.setup((x) => x.query(moq.It.is((q: string) => (-1 !== q.indexOf("FROM bis.Subject"))), undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }))
      .returns(async function* () {
        const list = new Array<{ id: Id64String, parentId: Id64String }>();
        props.subjectsHierarchy.forEach((ids, parentId) => ids.forEach((id) => list.push({ id, parentId })));
        while (list.length)
          yield list.shift();
      });
    props.imodelMock.setup((x) => x.query(moq.It.is((q: string) => (-1 !== q.indexOf("FROM bis.InformationPartitionElement"))), undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }))
      .returns(async function* () {
        const list = new Array<{ id: Id64String, subjectId: Id64String, content?: string }>();
        props.subjectModels.forEach((modelInfos, subjectId) => modelInfos.forEach((modelInfo) => list.push({ id: modelInfo.id, subjectId, content: modelInfo.content })));
        while (list.length)
          yield list.shift();
      });
  };

  describe("constructor", () => {

    it("should subscribe for viewport change events", () => {
      const vpMock = mockViewport();
      createHandler({ viewport: vpMock.object });
      expect(vpMock.object.onViewedCategoriesPerModelChanged.numberOfListeners).to.eq(1);
      expect(vpMock.object.onViewedCategoriesChanged.numberOfListeners).to.eq(1);
      expect(vpMock.object.onViewedModelsChanged.numberOfListeners).to.eq(1);
      expect(vpMock.object.onAlwaysDrawnChanged.numberOfListeners).to.eq(1);
      expect(vpMock.object.onNeverDrawnChanged.numberOfListeners).to.eq(1);
    });

    it("should subscribe for 'onIModelHierarchyChanged' event if hierarchy auto update is enabled", () => {
      const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
      const changeEvent = new BeEvent<(args: IModelHierarchyChangeEventArgs) => void>();
      presentationManagerMock.setup((x) => x.onIModelHierarchyChanged).returns(() => changeEvent);
      Presentation.setPresentationManager(presentationManagerMock.object);
      createHandler({ viewport: mockViewport().object, hierarchyAutoUpdateEnabled: true });
      expect(changeEvent.numberOfListeners).to.eq(1);
    });

  });

  describe("dispose", () => {

    it("should unsubscribe from viewport change events", () => {
      const vpMock = mockViewport();
      using(createHandler({ viewport: vpMock.object }), (_) => { });
      expect(vpMock.object.onViewedCategoriesPerModelChanged.numberOfListeners).to.eq(0);
      expect(vpMock.object.onViewedCategoriesChanged.numberOfListeners).to.eq(0);
      expect(vpMock.object.onViewedModelsChanged.numberOfListeners).to.eq(0);
      expect(vpMock.object.onAlwaysDrawnChanged.numberOfListeners).to.eq(0);
      expect(vpMock.object.onNeverDrawnChanged.numberOfListeners).to.eq(0);
    });

    it("should unsubscribe from 'onIModelHierarchyChanged' event", () => {
      const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
      const changeEvent = new BeEvent<(args: IModelHierarchyChangeEventArgs) => void>();
      presentationManagerMock.setup((x) => x.onIModelHierarchyChanged).returns(() => changeEvent);
      Presentation.setPresentationManager(presentationManagerMock.object);
      using(createHandler({ viewport: mockViewport().object, hierarchyAutoUpdateEnabled: true }), (_) => { });
      expect(changeEvent.numberOfListeners).to.eq(0);
    });

  });

  describe("getDisplayStatus", () => {

    it("returns disabled when node is not an instance node", async () => {
      const node = {
        __key: {
          type: "custom",
          version: 0,
          pathFromRoot: [],
        },
        id: "custom",
        label: PropertyRecord.fromString("custom"),
      };

      const vpMock = mockViewport();

      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        const result = handler.getVisibilityStatus(node, node.__key);
        expect(isPromiseLike(result)).to.be.false;
        expect(result).to.include({ state: "hidden", isDisabled: true });
      });
    });

    describe("subject", () => {

      it("return disabled when active view is not spatial", async () => {
        const node = createSubjectNode();
        const vpMock = mockViewport();
        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.true;
          if (isPromiseLike(result))
            expect(await result).to.include({ state: "hidden", isDisabled: true });
        });
      });

      it("return 'hidden' when all models are not displayed", async () => {
        const subjectIds = ["0x1", "0x2"];
        const node = createSubjectNode(subjectIds);
        mockSubjectModelIds({
          imodelMock,
          subjectsHierarchy: new Map([["0x0", subjectIds]]),
          subjectModels: new Map([
            [subjectIds[0], [{ id: "0x3" }, { id: "0x4" }]],
            [subjectIds[1], [{ id: "0x5" }, { id: "0x6" }]],
          ]),
        });

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x3")).returns(() => false);
        viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => false);
        viewStateMock.setup((x) => x.viewsModel("0x5")).returns(() => false);
        viewStateMock.setup((x) => x.viewsModel("0x6")).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.true;
          if (isPromiseLike(result))
            expect(await result).to.include({ state: "hidden" });
        });
      });

      it("return 'visible' when at least one direct model is displayed", async () => {
        const subjectIds = ["0x1", "0x2"];
        const node = createSubjectNode(subjectIds);
        mockSubjectModelIds({
          imodelMock,
          subjectsHierarchy: new Map([["0x0", subjectIds]]),
          subjectModels: new Map([
            [subjectIds[0], [{ id: "0x3" }, { id: "0x4" }]],
            [subjectIds[1], [{ id: "0x5" }, { id: "0x6" }]],
          ]),
        });

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x3")).returns(() => false);
        viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => false);
        viewStateMock.setup((x) => x.viewsModel("0x5")).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x6")).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.true;
          if (isPromiseLike(result))
            expect(await result).to.include({ state: "visible" });
        });
      });

      it("return 'visible' when at least one nested model is displayed", async () => {
        const subjectIds = ["0x1", "0x2"];
        const node = createSubjectNode(subjectIds);
        mockSubjectModelIds({
          imodelMock,
          subjectsHierarchy: new Map([
            [subjectIds[0], ["0x3"]],
            [subjectIds[1], ["0x4"]],
            ["0x3", ["0x5", "0x6"]],
            ["0x7", ["0x8"]],
          ]),
          subjectModels: new Map([
            ["0x6", [{ id: "0x10" }, { id: "0x11" }]],
          ]),
        });

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x10")).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x11")).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.true;
          if (isPromiseLike(result))
            expect(await result).to.include({ state: "visible" });
        });
      });

      it("initializes subject models cache only once", async () => {
        const node = createSubjectNode();
        const key = node.__key.instanceKeys[0];

        mockSubjectModelIds({
          imodelMock,
          subjectsHierarchy: new Map([["0x0", [key.id]]]),
          subjectModels: new Map([[key.id, [{ id: "0x1" }, { id: "0x2" }]]]),
        });

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(moq.It.isAny())).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await Promise.all([handler.getVisibilityStatus(node, node.__key), handler.getVisibilityStatus(node, node.__key)]);
          // expect the `query` to be called only twice (once for subjects and once for models)
          imodelMock.verify((x) => x.query(moq.It.isAnyString(), undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }), moq.Times.exactly(2));
        });
      });

      describe("filtered", () => {

        it("return 'visible' when subject node matches filter and at least one model is visible", async () => {
          const node = createSubjectNode();
          const key = node.__key.instanceKeys[0];

          const filteredProvider = moq.Mock.ofType<FilteredPresentationTreeDataProvider>();
          filteredProvider.setup((x) => x.nodeMatchesFilter(node)).returns(() => true);

          mockSubjectModelIds({
            imodelMock,
            subjectsHierarchy: new Map([["0x0", [key.id]]]),
            subjectModels: new Map([[key.id, [{ id: "0x10" }, { id: "0x20" }]]]),
          });

          const viewStateMock = moq.Mock.ofType<ViewState3d>();
          viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
          viewStateMock.setup((x) => x.viewsModel("0x10")).returns(() => true);
          viewStateMock.setup((x) => x.viewsModel("0x20")).returns(() => false);

          const vpMock = mockViewport({ viewState: viewStateMock.object });

          await using(createHandler({ viewport: vpMock.object }), async (handler) => {
            handler.setFilteredDataProvider(filteredProvider.object);
            const result = handler.getVisibilityStatus(node, node.__key);
            expect(isPromiseLike(result)).to.be.true;
            if (isPromiseLike(result))
              expect(await result).to.include({ state: "visible" });
            filteredProvider.verifyAll();
          });
        });

        it("return 'visible' when subject node with children matches filter and at least one model is visible", async () => {
          const parentSubjectId = "0x1";
          const childSubjectId = "0x2";
          const node = createSubjectNode(parentSubjectId);
          const childNode = createSubjectNode(childSubjectId);

          const filteredProvider = moq.Mock.ofType<FilteredPresentationTreeDataProvider>();
          filteredProvider.setup(async (x) => x.getNodes(node)).returns(async () => [childNode]).verifiable(moq.Times.never());
          filteredProvider.setup(async (x) => x.getNodes(childNode)).returns(async () => []).verifiable(moq.Times.never());
          filteredProvider.setup((x) => x.nodeMatchesFilter(moq.It.isAny())).returns(() => true);

          mockSubjectModelIds({
            imodelMock,
            subjectsHierarchy: new Map([
              [parentSubjectId, [childSubjectId]],
            ]),
            subjectModels: new Map([
              [parentSubjectId, [{ id: "0x10" }, { id: "0x11" }]],
              [childSubjectId, [{ id: "0x20" }]],
            ]),
          });

          const viewStateMock = moq.Mock.ofType<ViewState3d>();
          viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
          viewStateMock.setup((x) => x.viewsModel("0x10")).returns(() => true);
          viewStateMock.setup((x) => x.viewsModel("0x11")).returns(() => false);
          viewStateMock.setup((x) => x.viewsModel("0x20")).returns(() => false);

          const vpMock = mockViewport({ viewState: viewStateMock.object });

          await using(createHandler({ viewport: vpMock.object }), async (handler) => {
            handler.setFilteredDataProvider(filteredProvider.object);
            const result = handler.getVisibilityStatus(node, node.__key);
            expect(isPromiseLike(result)).to.be.true;
            if (isPromiseLike(result))
              expect(await result).to.include({ state: "visible" });
            filteredProvider.verifyAll();
          });
        });

        it("return 'visible' when subject node with children does not match filter and at least one child has visible models", async () => {
          const parentSubjectId = "0x1";
          const childSubjectIds = ["0x2", "0x3"];
          const node = createSubjectNode(parentSubjectId);
          const childNodes = [createSubjectNode(childSubjectIds[0]), createSubjectNode(childSubjectIds[1])];

          const filteredProvider = moq.Mock.ofType<FilteredPresentationTreeDataProvider>();
          filteredProvider.setup(async (x) => x.getNodes(node)).returns(async () => childNodes).verifiable(moq.Times.once());
          filteredProvider.setup(async (x) => x.getNodes(childNodes[0])).returns(async () => []).verifiable(moq.Times.never());
          filteredProvider.setup(async (x) => x.getNodes(childNodes[1])).returns(async () => []).verifiable(moq.Times.never());
          filteredProvider.setup((x) => x.getNodeKey(childNodes[0])).returns(() => childNodes[0].__key).verifiable(moq.Times.once());
          filteredProvider.setup((x) => x.getNodeKey(childNodes[1])).returns(() => childNodes[1].__key).verifiable(moq.Times.once());
          filteredProvider.setup((x) => x.nodeMatchesFilter(node)).returns(() => false);
          filteredProvider.setup((x) => x.nodeMatchesFilter(childNodes[0])).returns(() => true);
          filteredProvider.setup((x) => x.nodeMatchesFilter(childNodes[1])).returns(() => true);

          mockSubjectModelIds({
            imodelMock,
            subjectsHierarchy: new Map([
              [parentSubjectId, childSubjectIds],
            ]),
            subjectModels: new Map([
              [parentSubjectId, [{ id: "0x10" }]],
              [childSubjectIds[0], [{ id: "0x20" }]],
              [childSubjectIds[1], [{ id: "0x30" }]],
            ]),
          });

          const viewStateMock = moq.Mock.ofType<ViewState3d>();
          viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
          viewStateMock.setup((x) => x.viewsModel("0x10")).returns(() => false);
          viewStateMock.setup((x) => x.viewsModel("0x20")).returns(() => false);
          viewStateMock.setup((x) => x.viewsModel("0x30")).returns(() => true);

          const vpMock = mockViewport({ viewState: viewStateMock.object });

          await using(createHandler({ viewport: vpMock.object }), async (handler) => {
            handler.setFilteredDataProvider(filteredProvider.object);
            const result = handler.getVisibilityStatus(node, node.__key);
            expect(isPromiseLike(result)).to.be.true;
            if (isPromiseLike(result))
              expect(await result).to.include({ state: "visible" });
            filteredProvider.verifyAll();
          });
        });

        it("return 'hidden' when subject node with children does not match filter and children models are not visible", async () => {
          const parentSubjectIds = ["0x1", "0x2"];
          const childSubjectId = "0x3";
          const node = createSubjectNode(parentSubjectIds);
          const childNode = createSubjectNode(childSubjectId);

          const filteredProvider = moq.Mock.ofType<FilteredPresentationTreeDataProvider>();
          filteredProvider.setup(async (x) => x.getNodes(node)).returns(async () => [childNode]).verifiable(moq.Times.once());
          filteredProvider.setup(async (x) => x.getNodes(childNode)).returns(async () => []).verifiable(moq.Times.never());
          filteredProvider.setup((x) => x.getNodeKey(childNode)).returns(() => childNode.__key).verifiable(moq.Times.once());
          filteredProvider.setup((x) => x.nodeMatchesFilter(node)).returns(() => false);
          filteredProvider.setup((x) => x.nodeMatchesFilter(childNode)).returns(() => true);

          mockSubjectModelIds({
            imodelMock,
            subjectsHierarchy: new Map([
              [parentSubjectIds[0], [childSubjectId]],
              [parentSubjectIds[1], [childSubjectId]],
            ]),
            subjectModels: new Map([
              [parentSubjectIds[0], [{ id: "0x10" }]],
              [parentSubjectIds[1], [{ id: "0x20" }]],
              [childSubjectId, [{ id: "0x30" }]],
            ]),
          });

          const viewStateMock = moq.Mock.ofType<ViewState3d>();
          viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
          viewStateMock.setup((x) => x.viewsModel("0x10")).returns(() => false);
          viewStateMock.setup((x) => x.viewsModel("0x20")).returns(() => false);
          viewStateMock.setup((x) => x.viewsModel("0x30")).returns(() => false);

          const vpMock = mockViewport({ viewState: viewStateMock.object });

          await using(createHandler({ viewport: vpMock.object }), async (handler) => {
            handler.setFilteredDataProvider(filteredProvider.object);
            const result = handler.getVisibilityStatus(node, node.__key);
            expect(isPromiseLike(result)).to.be.true;
            if (isPromiseLike(result))
              expect(await result).to.include({ state: "hidden" });
            filteredProvider.verifyAll();
          });
        });

      });

    });

    describe("model", () => {

      it("return disabled when active view is not spatial", async () => {
        const node = createModelNode();
        const vpMock = mockViewport();
        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden", isDisabled: true });
        });
      });

      it("return 'visible' when displayed", async () => {
        const node = createModelNode();
        const key = node.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(key.id)).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "visible" });
        });
      });

      it("returns 'hidden' when not displayed", async () => {
        const node = createModelNode();
        const key = node.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(key.id)).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden" });
        });
      });

    });

    describe("category", () => {

      it("return disabled when model not displayed", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = parentModelNode.__key.instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(categoryNode, categoryNode.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden", isDisabled: true });
        });
      });

      it("return 'visible' when model displayed, category not displayed but per-model override says it's displayed", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = parentModelNode.__key.instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const categoryKey = categoryNode.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => true);

        const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();
        perModelCategoryVisibilityMock.setup((x) => x.getOverride(parentModelKey.id, categoryKey.id)).returns(() => PerModelCategoryVisibility.Override.Show);

        const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(categoryNode, categoryNode.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "visible" });
        });
      });

      it("return 'visible' when model displayed, category displayed and there're no per-model overrides", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = parentModelNode.__key.instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const key = categoryNode.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(key.id)).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(categoryNode, categoryNode.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "visible" });
        });
      });

      it("return 'hidden' when model displayed, category displayed but per-model override says it's not displayed", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = parentModelNode.__key.instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const categoryKey = categoryNode.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => true);

        const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();
        perModelCategoryVisibilityMock.setup((x) => x.getOverride(parentModelKey.id, categoryKey.id)).returns(() => PerModelCategoryVisibility.Override.Hide);

        const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(categoryNode, categoryNode.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden" });
        });
      });

      it("return 'hidden' when model displayed, category not displayed and there're no per-model overrides", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = parentModelNode.__key.instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const key = categoryNode.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(key.id)).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(categoryNode, categoryNode.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden" });
        });
      });

      it("return 'hidden' when category has no parent model and category is not displayed", async () => {
        const categoryNode = createCategoryNode();
        const categoryKey = categoryNode.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(categoryNode, categoryNode.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden" });
        });
      });

    });

    describe("element class grouping", () => {

      it("returns disabled when model not displayed", async () => {
        const groupedElementIds = ["0x11", "0x12", "0x13"];
        const node = createElementClassGroupingNode(groupedElementIds);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => false);
        const vpMock = mockViewport({ viewState: viewStateMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getGroupedElementIds = async () => ({
            categoryId: "0x1",
            modelId: "0x2",
            elementIds: {
              async* getElementIds() {
                for (const id of groupedElementIds)
                  yield id;
              },
            },
          });

          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.true;
          expect(await result).to.include({ state: "hidden", isDisabled: true });
        });
      });

      it("returns 'visible' when model displayed and at least one element is in always displayed list", async () => {
        const groupedElementIds = ["0x11", "0x12", "0x13"];
        const node = createElementClassGroupingNode(groupedElementIds);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        const alwaysDrawn = new Set([groupedElementIds[1]]);
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDrawn);

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getGroupedElementIds = async () => ({
            categoryId: "0x1",
            modelId: "0x2",
            elementIds: {
              async* getElementIds() {
                for (const id of groupedElementIds)
                  yield id;
              },
            },
          });

          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.true;
          expect(await result).to.include({ state: "visible" });
        });
      });

      it("returns 'hidden' when model displayed and there's at least one element in always exclusive displayed list that's not grouped under node", async () => {
        const groupedElementIds = ["0x11", "0x12", "0x13"];
        const node = createElementClassGroupingNode(groupedElementIds);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        const alwaysDrawn = new Set(["0x4"]);
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDrawn);
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => true);

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getGroupedElementIds = async () => ({
            categoryId: "0x1",
            modelId: "0x2",
            elementIds: {
              async* getElementIds() {
                for (const id of groupedElementIds)
                  yield id;
              },
            },
          });

          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.true;
          expect(await result).to.include({ state: "hidden" });
        });
      });

      it("returns 'hidden' when model displayed and all elements are in never displayed list", async () => {
        const groupedElementIds = ["0x11", "0x12", "0x13"];
        const node = createElementClassGroupingNode(groupedElementIds);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        const neverDrawn = new Set(groupedElementIds);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDrawn);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getGroupedElementIds = async () => ({
            categoryId: "0x1",
            modelId: "0x2",
            elementIds: {
              async* getElementIds() {
                for (const id of groupedElementIds)
                  yield id;
              },
            },
          });

          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.true;
          expect(await result).to.include({ state: "hidden" });
        });
      });

      it("returns 'hidden' when model displayed and category not displayed", async () => {
        const groupedElementIds = ["0x11", "0x12", "0x13"];
        const node = createElementClassGroupingNode(groupedElementIds);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        const neverDrawn = new Set(["0x11"]);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDrawn);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getGroupedElementIds = async () => ({
            categoryId: "0x1",
            modelId: "0x2",
            elementIds: {
              async* getElementIds() {
                for (const id of groupedElementIds)
                  yield id;
              },
            },
          });

          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.true;
          expect(await result).to.include({ state: "hidden" });
        });
      });

      it("returns 'visible' when model displayed and category displayed", async () => {
        const groupedElementIds = ["0x11", "0x12", "0x13"];
        const node = createElementClassGroupingNode(groupedElementIds);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        const neverDrawn = new Set(["0x11"]);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDrawn);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getGroupedElementIds = async () => ({
            categoryId: "0x1",
            modelId: "0x2",
            elementIds: {
              async* getElementIds() {
                for (const id of groupedElementIds)
                  yield id;
              },
            },
          });

          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.true;
          expect(await result).to.include({ state: "visible" });
        });
      });

    });

    describe("element", () => {

      it("returns disabled when modelId not set", async () => {
        const node = createElementNode(undefined, "0x1");

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(moq.It.isAny())).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden", isDisabled: true });
        });
      });

      it("returns disabled when model not displayed", async () => {
        const node = createElementNode("0x2", "0x1");

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => false);
        const vpMock = mockViewport({ viewState: viewStateMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden", isDisabled: true });
        });
      });

      it("returns 'hidden' when model displayed, category displayed, but element is in never displayed list", async () => {
        const node = createElementNode("0x2", "0x1");
        const key = node.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        const neverDrawn = new Set([key.id]);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDrawn);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => undefined);

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden" });
        });
      });

      it("returns 'visible' when model displayed and element is in always displayed list", async () => {
        const node = createElementNode("0x2", "0x1");
        const key = node.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        const alwaysDrawn = new Set([key.id]);
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDrawn);

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "visible" });
        });
      });

      it("returns 'visible' when model displayed, category displayed and element is in neither 'never' nor 'always' displayed", async () => {
        const node = createElementNode("0x2", "0x1");

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup((x) => x.alwaysDrawn).returns(() => undefined);
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "visible" });
        });
      });

      it("returns 'hidden' when model displayed, category not displayed and element is in neither 'never' nor 'always' displayed", async () => {
        const node = createElementNode("0x2", "0x1");

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup((x) => x.alwaysDrawn).returns(() => undefined);
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden" });
        });
      });

      it("returns 'hidden' when model displayed, category displayed and some other element is exclusively 'always' displayed", async () => {
        const node = createElementNode("0x2", "0x1");

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => true);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set([createRandomId()]));
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden" });
        });
      });

      it("returns 'hidden' when model displayed, categoryId not set and element is in neither 'never' nor 'always' displayed", async () => {
        const node = createElementNode("0x2", undefined);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(moq.It.isAny())).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());
        vpMock.setup((x) => x.neverDrawn).returns(() => new Set());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node, node.__key);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden" });
        });
      });

    });

  });

  describe("changeVisibility", () => {

    it("does nothing when node is not an instance node", async () => {
      const node = {
        __key: {
          type: "custom",
          version: 0,
          pathFromRoot: [],
        },
        id: "custom",
        label: PropertyRecord.fromString("custom"),
      };

      const vpMock = mockViewport();
      vpMock.setup(async (x) => x.addViewedModels(moq.It.isAny())).verifiable(moq.Times.never());

      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        await handler.changeVisibility(node, node.__key, true);
        vpMock.verifyAll();
      });
    });

    describe("subject", () => {

      it("does nothing for non-spatial views", async () => {
        const node = createSubjectNode();

        const viewStateMock = moq.Mock.ofType<ViewState>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup(async (x) => x.addViewedModels(moq.It.isAny())).verifiable(moq.Times.never());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running a query on the imodel
          (handler as any).getSubjectModelIds = async () => ["0x1", "0x2"];

          await handler.changeVisibility(node, node.__key, true);
          vpMock.verifyAll();
        });
      });

      it("makes all subject models visible", async () => {
        const node = createSubjectNode();
        const subjectModelIds = ["0x1", "0x2"];

        const viewStateMock = moq.Mock.ofType<SpatialViewState>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup(async (x) => x.addViewedModels(subjectModelIds)).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running a query on the imodel
          (handler as any).getSubjectModelIds = async () => subjectModelIds;

          await handler.changeVisibility(node, node.__key, true);
          vpMock.verifyAll();
        });
      });

      it("makes all subject models hidden", async () => {
        const node = createSubjectNode();
        const subjectModelIds = ["0x1", "0x2"];

        const viewStateMock = moq.Mock.ofType<SpatialViewState>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup((x) => x.changeModelDisplay(subjectModelIds, false)).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running a query on the imodel
          (handler as any).getSubjectModelIds = async () => subjectModelIds;

          await handler.changeVisibility(node, node.__key, false);
          vpMock.verifyAll();
        });
      });

      describe("filtered", () => {

        ["visible", "hidden"].map((mode) => {
          it(`makes all subject models ${mode} when subject node does not have children`, async () => {
            const node = createSubjectNode();
            const key = node.__key.instanceKeys[0];
            const subjectModelIds = ["0x1", "0x2"];

            const filteredDataProvider = moq.Mock.ofType<FilteredPresentationTreeDataProvider>();
            filteredDataProvider.setup(async (x) => x.getNodes(node)).returns(async () => []).verifiable(moq.Times.never());
            filteredDataProvider.setup((x) => x.nodeMatchesFilter(node)).returns(() => true);

            const viewStateMock = moq.Mock.ofType<SpatialViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

            mockSubjectModelIds({
              imodelMock,
              subjectsHierarchy: new Map([]),
              subjectModels: new Map([
                [key.id, [{ id: subjectModelIds[0], content: "reference" }, { id: subjectModelIds[1] }]],
              ]),
            });

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            if (mode === "visible") {
              vpMock.setup(async (x) => x.addViewedModels(subjectModelIds)).verifiable();
            } else {
              vpMock.setup((x) => x.changeModelDisplay(subjectModelIds, false)).verifiable();
            }

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              handler.setFilteredDataProvider(filteredDataProvider.object);
              await handler.changeVisibility(node, node.__key, mode === "visible");
              vpMock.verifyAll();
              filteredDataProvider.verifyAll();
            });
          });

          it(`makes only children ${mode} if parent node does not match filter`, async () => {
            const node = createSubjectNode("0x1");
            const childNode = createSubjectNode("0x2");
            const parentSubjectModelIds = ["0x10", "0x11"];
            const childSubjectModelIds = ["0x20"];

            const filteredDataProvider = moq.Mock.ofType<FilteredPresentationTreeDataProvider>();
            filteredDataProvider.setup(async (x) => x.getNodes(node)).returns(async () => [childNode]).verifiable(moq.Times.once());
            filteredDataProvider.setup(async (x) => x.getNodes(childNode)).returns(async () => []).verifiable(moq.Times.never());
            filteredDataProvider.setup((x) => x.getNodeKey(childNode)).returns(() => childNode.__key).verifiable(moq.Times.once());
            filteredDataProvider.setup((x) => x.nodeMatchesFilter(node)).returns(() => false);
            filteredDataProvider.setup((x) => x.nodeMatchesFilter(childNode)).returns(() => true);

            const viewStateMock = moq.Mock.ofType<SpatialViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

            mockSubjectModelIds({
              imodelMock,
              subjectsHierarchy: new Map([
                ["0x1", ["0x2"]],
              ]),
              subjectModels: new Map([
                ["0x1", [{ id: parentSubjectModelIds[0] }, { id: parentSubjectModelIds[1] }]],
                ["0x2", [{ id: childSubjectModelIds[0] }]],
              ]),
            });

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            if (mode === "visible") {
              vpMock.setup(async (x) => x.addViewedModels(childSubjectModelIds)).verifiable();
            } else {
              vpMock.setup((x) => x.changeModelDisplay(childSubjectModelIds, false)).verifiable();
            }

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              handler.setFilteredDataProvider(filteredDataProvider.object);
              await handler.changeVisibility(node, node.__key, mode === "visible");
              vpMock.verifyAll();
              filteredDataProvider.verifyAll();
            });

          });

        });

      });

    });

    describe("model", () => {

      it("does nothing for non-spatial views", async () => {
        const node = createModelNode();

        const viewStateMock = moq.Mock.ofType<ViewState>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup(async (x) => x.addViewedModels(moq.It.isAny())).verifiable(moq.Times.never());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(node, node.__key, true);
          vpMock.verifyAll();
        });
      });

      it("makes model visible", async () => {
        const node = createModelNode();
        const key = node.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<SpatialViewState>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup(async (x) => x.addViewedModels([key.id])).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(node, node.__key, true);
          vpMock.verifyAll();
        });
      });

      it("makes model hidden", async () => {
        const node = createModelNode();
        const key = node.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<SpatialViewState>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup((x) => x.changeModelDisplay([key.id], false)).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(node, node.__key, false);
          vpMock.verifyAll();
        });
      });

    });

    describe("category", () => {

      it("makes category visible through per-model override when it's not visible through category selector", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = parentModelNode.__key.instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const categoryKey = categoryNode.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => false);

        const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

        const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(categoryNode, categoryNode.__key, true);
          perModelCategoryVisibilityMock.verify((x) => x.setOverride(parentModelKey.id, categoryKey.id, PerModelCategoryVisibility.Override.Show), moq.Times.once());
          vpMock.verify((x) => x.changeCategoryDisplay(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        });
      });

      it("makes category hidden through override when it's visible through category selector", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = parentModelNode.__key.instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const categoryKey = categoryNode.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => true);

        const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

        const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(categoryNode, categoryNode.__key, false);
          perModelCategoryVisibilityMock.verify((x) => x.setOverride(parentModelKey.id, categoryKey.id, PerModelCategoryVisibility.Override.Hide), moq.Times.once());
          vpMock.verify((x) => x.changeCategoryDisplay(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        });
      });

      it("removes category override and enables all sub-categories when making visible and it's visible through category selector", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = parentModelNode.__key.instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const categoryKey = categoryNode.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => true);

        const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

        const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(categoryNode, categoryNode.__key, true);
          perModelCategoryVisibilityMock.verify((x) => x.setOverride(parentModelKey.id, categoryKey.id, PerModelCategoryVisibility.Override.None), moq.Times.once());
          vpMock.verify((x) => x.changeCategoryDisplay([categoryKey.id], true, true), moq.Times.once());
        });
      });

      it("removes category override when making hidden and it's hidden through category selector", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = parentModelNode.__key.instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const categoryKey = categoryNode.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => false);

        const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

        const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(categoryNode, categoryNode.__key, false);
          perModelCategoryVisibilityMock.verify((x) => x.setOverride(parentModelKey.id, categoryKey.id, PerModelCategoryVisibility.Override.None), moq.Times.once());
          vpMock.verify((x) => x.changeCategoryDisplay(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        });
      });

      it("makes category visible in selector and enables all sub-categories when category has no parent model", async () => {
        const categoryNode = createCategoryNode();
        const categoryKey = categoryNode.__key.instanceKeys[0];

        const vpMock = mockViewport();
        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(categoryNode, categoryNode.__key, true);
          vpMock.verify((x) => x.changeCategoryDisplay([categoryKey.id], true, true), moq.Times.once());
        });
      });

      it("makes category hidden in selector when category has no parent model", async () => {
        const categoryNode = createCategoryNode();
        const categoryKey = categoryNode.__key.instanceKeys[0];

        const vpMock = mockViewport();
        vpMock.setup((x) => x.changeCategoryDisplay([categoryKey.id], false)).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(categoryNode, categoryNode.__key, false);
          vpMock.verify((x) => x.changeCategoryDisplay([categoryKey.id], false, false), moq.Times.once());
        });
      });

    });

    describe("element class grouping", () => {

      it("makes elements visible by removing from never displayed list and adding to always displayed list when category is not displayed", async () => {
        const groupedElementIds = ["0x11", "0x12", "0x13"];
        const node = createElementClassGroupingNode(groupedElementIds);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        const alwaysDisplayed = new Set<string>();
        const neverDisplayed = new Set([groupedElementIds[0]]);
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
        vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => {
          return set.size === 3
            && groupedElementIds.reduce<boolean>((result, id) => (result && set.has(id)), true);
        }), false)).verifiable();
        vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => (set.size === 0)))).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getGroupedElementIds = async () => ({
            categoryId: "0x1",
            modelId: "0x2",
            elementIds: {
              async* getElementIds() {
                for (const id of groupedElementIds)
                  yield id;
              },
            },
          });

          await handler.changeVisibility(node, node.__key, true);
          vpMock.verifyAll();
        });
      });

    });

    describe("element", () => {

      it("makes element visible by only removing from never displayed list when element's category is displayed", async () => {
        const node = createElementNode("0x4", "0x3");
        const key = node.__key.instanceKeys[0];
        const assemblyChildrenIds = ["0x1", "0x2"];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x3")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        const alwaysDisplayed = new Set<string>();
        const neverDisplayed = new Set([key.id]);
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
        vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => (set.size === 0)))).verifiable();
        vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => (set.size === 0)), false)).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getAssemblyElementIds = () => ({
            async* getElementIds() {
              for (const id of assemblyChildrenIds)
                yield id;
            },
          });

          await handler.changeVisibility(node, node.__key, true);
          vpMock.verifyAll();
        });
      });

      it("makes element visible by removing from never displayed list and adding to always displayed list when category is not displayed", async () => {
        const node = createElementNode("0x4", "0x3");
        const key = node.__key.instanceKeys[0];
        const assemblyChildrenIds = ["0x1", "0x2"];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x4")).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x3")).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        const alwaysDisplayed = new Set<string>();
        const neverDisplayed = new Set([key.id]);
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
        vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => {
          return set.size === 3
            && set.has(key.id)
            && assemblyChildrenIds.reduce<boolean>((result, id) => (result && set.has(id)), true);
        }), false)).verifiable();
        vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => (set.size === 0)))).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running a query on the imodel
          (handler as any).getAssemblyElementIds = () => ({
            async* getElementIds() {
              for (const id of assemblyChildrenIds)
                yield id;
            },
          });

          await handler.changeVisibility(node, node.__key, true);
          vpMock.verifyAll();
        });
      });

      it("makes element visible by adding to always displayed list when category is displayed, but element is hidden due to other elements exclusively always drawn", async () => {
        const node = createElementNode("0x4", "0x3");
        const key = node.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x4")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x3")).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        const alwaysDisplayed = new Set<Id64String>([createRandomId()]);
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => true);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
        vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => {
          return set.size === 2 && set.has(key.id);
        }), true)).verifiable();
        vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => (set.size === 0)))).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running a query on the imodel
          (handler as any).getAssemblyElementIds = () => ({
            async* getElementIds() { },
          });

          await handler.changeVisibility(node, node.__key, true);
          vpMock.verifyAll();
        });
      });

      it("makes element hidden by only removing from always displayed list when element's category is not displayed", async () => {
        const node = createElementNode("0x4", "0x3");
        const key = node.__key.instanceKeys[0];
        const assemblyChildrenIds = ["0x1", "0x2"];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x3")).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        const alwaysDisplayed = new Set([key.id]);
        const neverDisplayed = new Set<string>();
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
        vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => (set.size === 0)))).verifiable();
        vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => (set.size === 0)), false)).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getAssemblyElementIds = () => ({
            async* getElementIds() {
              for (const id of assemblyChildrenIds)
                yield id;
            },
          });

          await handler.changeVisibility(node, node.__key, false);
          vpMock.verifyAll();
        });
      });

      it("makes element hidden by removing from always displayed list and adding to never displayed list when category is displayed", async () => {
        const node = createElementNode("0x4", "0x3");
        const key = node.__key.instanceKeys[0];
        const assemblyChildrenIds = ["0x1", "0x2"];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x3")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        const alwaysDisplayed = new Set([key.id]);
        const neverDisplayed = new Set<string>();
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
        vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => (set.size === 0)), false)).verifiable();
        vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => {
          return set.size === 3
            && set.has(key.id)
            && assemblyChildrenIds.reduce<boolean>((result, id) => (result && set.has(id)), true);
        }))).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running a query on the imodel
          (handler as any).getAssemblyElementIds = () => ({
            async* getElementIds() {
              for (const id of assemblyChildrenIds)
                yield id;
            },
          });

          await handler.changeVisibility(node, node.__key, false);
          vpMock.verifyAll();
        });
      });

      it("makes element hidden by removing from always displayed list when category is displayed and there are exclusively always drawn elements", async () => {
        const node = createElementNode("0x4", "0x3");
        const key = node.__key.instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x3")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        const alwaysDisplayed = new Set([key.id, createRandomId()]);
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => true);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
        vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => (set.size === 1 && !set.has(key.id))), true)).verifiable();
        vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => (set.size === 0)))).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running a query on the imodel
          (handler as any).getAssemblyElementIds = () => ({
            async* getElementIds() { },
          });

          await handler.changeVisibility(node, node.__key, false);
          vpMock.verifyAll();
        });
      });

    });

  });

  describe("visibility change event", () => {

    it("raises event on `onAlwaysDrawnChanged` event", async () => {
      const evt = new BeEvent();
      const vpMock = mockViewport({ onAlwaysDrawnChanged: evt });
      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        evt.raiseEvent(vpMock.object);
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });

    it("raises event on `onNeverDrawnChanged` event", async () => {
      const evt = new BeEvent();
      const vpMock = mockViewport({ onNeverDrawnChanged: evt });
      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        evt.raiseEvent(vpMock.object);
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });

    it("raises event on `onViewedCategoriesChanged` event", async () => {
      const evt = new BeEvent();
      const vpMock = mockViewport({ onViewedCategoriesChanged: evt });
      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        evt.raiseEvent(vpMock.object);
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });

    it("raises event on `onViewedModelsChanged` event", async () => {
      const evt = new BeEvent();
      const vpMock = mockViewport({ onViewedModelsChanged: evt });
      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        evt.raiseEvent(vpMock.object);
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });

    it("raises event on `onViewedCategoriesPerModelChanged` event", async () => {
      const evt = new BeEvent();
      const vpMock = mockViewport({ onViewedCategoriesPerModelChanged: evt });
      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        evt.raiseEvent(vpMock.object);
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });

    it("raises event once when multiple affecting events are fired", async () => {
      const evts = {
        onViewedCategoriesPerModelChanged: new BeEvent<(vp: Viewport) => void>(),
        onViewedCategoriesChanged: new BeEvent<(vp: Viewport) => void>(),
        onViewedModelsChanged: new BeEvent<(vp: Viewport) => void>(),
        onAlwaysDrawnChanged: new BeEvent<() => void>(),
        onNeverDrawnChanged: new BeEvent<() => void>(),
      };
      const vpMock = mockViewport({ ...evts });
      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        evts.onViewedCategoriesPerModelChanged.raiseEvent(vpMock.object);
        evts.onViewedCategoriesChanged.raiseEvent(vpMock.object);
        evts.onViewedModelsChanged.raiseEvent(vpMock.object);
        evts.onAlwaysDrawnChanged.raiseEvent();
        evts.onNeverDrawnChanged.raiseEvent();
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });

  });

});
