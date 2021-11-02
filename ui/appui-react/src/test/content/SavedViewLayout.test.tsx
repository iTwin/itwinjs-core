/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Point3d, Range3d, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
import {
  CategorySelectorProps, DisplayStyleProps, EcefLocation, ModelSelectorProps, SheetProps, SpatialViewDefinitionProps, ViewStateProps,
} from "@itwin/core-common";
import { DrawingViewState, EmphasizeElements, IModelConnection, MockRender, ScreenViewport, SheetViewState, SpatialViewState, SubCategoriesCache, ViewState } from "@itwin/core-frontend";
import { StandardContentLayouts } from "@itwin/appui-abstract";
import { expect } from "chai";
import * as React from "react";
import * as moq from "typemoq";
import {
  ConfigurableCreateInfo, ConfigurableUiManager, ContentGroup, ContentLayoutDef, ContentLayoutManager, ContentProps, CoreTools, Frontstage,
  FrontstageManager, FrontstageProps, FrontstageProvider, NavigationWidget, SavedViewLayout, SavedViewLayoutProps, ViewportContentControl, Widget,
  Zone,
} from "../../appui-react";
import { ViewUtilities } from "../../appui-react/utils/ViewUtilities";
import TestUtils from "../TestUtils";

describe("SavedViewLayout", () => {

  const extents = Vector3d.create(400, 400);
  const origin = Point3d.createZero();
  const delta = Point3d.createZero();

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const viewsMock = moq.Mock.ofType<IModelConnection.Views>();

  imodelMock.setup((x) => x.views).returns(() => viewsMock.object);
  imodelMock.setup((x) => x.subcategories).returns(() => new SubCategoriesCache(imodelMock.object));
  imodelMock.setup((x) => x.models).returns(() => new IModelConnection.Models(imodelMock.object));
  imodelMock.setup((x) => x.ecefLocation).returns(() => new EcefLocation({ origin: Point3d.createZero(), orientation: YawPitchRollAngles.createRadians(0, 0, 0) }));
  imodelMock.setup((x) => x.projectExtents).returns(() => Range3d.create(Point3d.createZero()));

  const viewDefinitionProps1: SpatialViewDefinitionProps = {
    cameraOn: false, origin, extents,
    camera: { lens: 0, focusDist: 1, eye: [0, 0, 0] },
    classFullName: "Bis:SpatialViewDefinition",
    id: "id1",
    modelSelectorId: "id1", categorySelectorId: "id1", displayStyleId: "id1",
    model: "model", code: { spec: "spec", scope: "scope" },
  };

  const viewDefinitionProps2 = {
    cameraOn: false, origin, extents,
    camera: { lens: 0, focusDist: 1, eye: [0, 0, 0] },
    classFullName: "Bis:DrawingViewDefinition",
    id: "id1",
    categorySelectorId: "id1", displayStyleId: "id1",
    model: "model", code: { spec: "spec", scope: "scope" },
    baseModelId: "model", delta, angle: 0,
  };

  const viewDefinitionProps3 = {
    cameraOn: false, origin, extents,
    camera: { lens: 0, focusDist: 1, eye: [0, 0, 0] },
    classFullName: "Bis:SheetViewDefinition",
    id: "id1",
    categorySelectorId: "id1", displayStyleId: "id1",
    model: "model", code: { spec: "spec", scope: "scope" },
    baseModelId: "model", delta, angle: 0,
  };

  const categorySelectorProps: CategorySelectorProps = {
    categories: ["category1"],
    model: "model",
    code: { spec: "spec", scope: "scope" },
    classFullName: "schema:classname",
  };

  const modelSelectorProps: ModelSelectorProps = {
    models: ["model1"],
    model: "model",
    code: { spec: "spec", scope: "scope" },
    classFullName: "schema:classname",
  };

  const displayStyleProps: DisplayStyleProps = {
    model: "model",
    code: { spec: "spec", scope: "scope" },
    classFullName: "schema:classname",
  };

  const sheetProps: SheetProps = {
    model: "model",
    code: { spec: "spec", scope: "scope" },
    classFullName: "schema:classname",
    width: 100, height: 100,
  };

  const viewStateProps1: ViewStateProps = {
    viewDefinitionProps: viewDefinitionProps1,
    categorySelectorProps,
    modelSelectorProps,
    displayStyleProps,
  };

  const viewStateProps2: ViewStateProps = {
    viewDefinitionProps: viewDefinitionProps2,
    categorySelectorProps,
    modelSelectorProps,
    displayStyleProps,
  };

  const viewStateProps3: ViewStateProps = {
    viewDefinitionProps: viewDefinitionProps3,
    categorySelectorProps,
    modelSelectorProps,
    displayStyleProps,
    sheetProps,
    sheetAttachments: [],
  };

  let viewState: ViewState;

  viewsMock.setup((x) => x.load).returns(() => async (_viewId: string) => viewState);

  const viewportMock = moq.Mock.ofType<ScreenViewport>();

  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();

    // Required for SavedViewLayout
    ConfigurableUiManager.registerControl("TestViewport", TestViewportContentControl);
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  class TestViewportContentControl extends ViewportContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = <div />;

      this.viewport = viewportMock.object;
    }
  }
  class Frontstage1 extends FrontstageProvider {
    public static stageId = "Test1";
    public get id(): string {
      return Frontstage1.stageId;
    }

    public contentLayoutDef: ContentLayoutDef = new ContentLayoutDef(
      {
        id: "SingleContent",
        description: "App:ContentLayoutDef.SingleContent",
      },
    );

    public get frontstage(): React.ReactElement<FrontstageProps> {

      const myContentGroup: ContentGroup = new ContentGroup(
        {
          id: "MyContentGroup",
          layout: StandardContentLayouts.singleView,
          contents: [
            {
              id: "TestViewport",
              classId: TestViewportContentControl,
              applicationData: { label: "Content 1a", bgColor: "black" },
            },
          ],
        },
      );

      return (
        <Frontstage
          id={this.id}
          defaultTool={CoreTools.selectElementCommand}
          contentGroup={myContentGroup}

          topRight={
            <Zone widgets={[
              <Widget isFreeform={true} element={<NavigationWidget />} />, // eslint-disable-line deprecation/deprecation, react/jsx-key
            ]} />
          }
        />
      );
    }
  }

  beforeEach(async () => {
    FrontstageManager.clearFrontstageDefs();

    viewportMock.reset();
    viewportMock.setup((x) => x.view).returns(() => viewState);
  });

  it("should create and parse Spatial saved view layout", async () => {
    const vs = SpatialViewState.createFromProps(viewStateProps1, imodelMock.object);
    imodelMock.setup(async (x) => x.findClassFor(moq.It.isAny(), moq.It.isAny())).returns(async () => Promise.resolve<any>(SpatialViewState));

    if (vs)
      viewState = vs;
    else
      throw Error("Couldn't create ViewState");

    let serializedSavedViewLayoutProps = "";

    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(Frontstage1.stageId);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);

    if (frontstageDef) {
      if (ContentLayoutManager.activeLayout && ContentLayoutManager.activeContentGroup) {
        const savedViewLayoutProps = SavedViewLayout.viewLayoutToProps(ContentLayoutManager.activeLayout, ContentLayoutManager.activeContentGroup);
        const serialized = JSON.stringify(savedViewLayoutProps);

        serializedSavedViewLayoutProps = serialized;
      }
    }

    const iModelConnection = imodelMock.object;
    if (serializedSavedViewLayoutProps && iModelConnection) {

      // Parse SavedViewLayoutProps
      const savedViewLayoutProps: SavedViewLayoutProps = JSON.parse(serializedSavedViewLayoutProps);
      // Create ContentLayoutDef
      const contentLayoutDef = new ContentLayoutDef(savedViewLayoutProps.contentLayoutProps ?? savedViewLayoutProps.contentGroupProps.layout);
      // Create ViewStates
      const viewStates = await SavedViewLayout.viewStatesFromProps(iModelConnection, savedViewLayoutProps);

      expect(contentLayoutDef.description).to.eq("Single Content View");
      expect(viewStates.length).to.eq(1);

      const viewState0 = viewStates[0];
      if (viewState0) {
        const bisBaseName = ViewUtilities.getBisBaseClass(viewState0.classFullName);
        expect(ViewUtilities.isSpatial(bisBaseName)).to.be.true;
      }

      // attempting to emphasize the elements should return false because it wasn't saved
      const contentGroup = new ContentGroup(savedViewLayoutProps.contentGroupProps);
      expect(SavedViewLayout.emphasizeElementsFromProps(contentGroup, savedViewLayoutProps)).to.be.false;
    }
  });

  it("should create and parse Drawing saved view layout", async () => {
    const emphasizeElements = new EmphasizeElements();
    emphasizeElements.wantEmphasis = true;
    viewportMock.setup((x) => x.neverDrawn).returns(() => undefined);
    viewportMock.setup((x) => x.alwaysDrawn).returns(() => undefined);

    const vs = DrawingViewState.createFromProps(viewStateProps2, imodelMock.object);
    imodelMock.setup(async (x) => x.findClassFor(moq.It.isAny(), moq.It.isAny())).returns(async () => Promise.resolve<any>(DrawingViewState));

    if (vs)
      viewState = vs;
    else
      throw Error("Couldn't create ViewState");

    let serializedSavedViewLayoutProps = "";

    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);

    if (frontstageDef) {
      if (ContentLayoutManager.activeLayout && ContentLayoutManager.activeContentGroup) {
        const getEmphasizeElements = EmphasizeElements.get;
        EmphasizeElements.get = () => emphasizeElements;

        const savedViewLayoutProps = SavedViewLayout.viewLayoutToProps(ContentLayoutManager.activeLayout, ContentLayoutManager.activeContentGroup, true,
          (contentProps: ContentProps) => {
            if (contentProps.applicationData)
              delete contentProps.applicationData;
          });

        EmphasizeElements.get = getEmphasizeElements;
        const serialized = JSON.stringify(savedViewLayoutProps);
        serializedSavedViewLayoutProps = serialized;
      }
    }

    const iModelConnection = imodelMock.object;
    if (serializedSavedViewLayoutProps && iModelConnection) {
      // Parse SavedViewLayoutProps
      const savedViewLayoutProps: SavedViewLayoutProps = JSON.parse(serializedSavedViewLayoutProps);
      // Create ContentLayoutDef
      const contentLayoutDef = new ContentLayoutDef(savedViewLayoutProps.contentLayoutProps ?? savedViewLayoutProps.contentGroupProps.layout);
      // Create ViewStates
      const viewStates = await SavedViewLayout.viewStatesFromProps(iModelConnection, savedViewLayoutProps);

      expect(contentLayoutDef.description).to.eq("Single Content View");
      expect(viewStates.length).to.eq(1);

      const viewState0 = viewStates[0];
      if (viewState0) {
        const bisBaseName = ViewUtilities.getBisBaseClass(viewState0.classFullName);
        expect(ViewUtilities.isDrawing(bisBaseName)).to.be.true;
      }

      const contentGroup = new ContentGroup(savedViewLayoutProps.contentGroupProps);
      expect(contentGroup.propsId).to.eq("MyContentGroup");

      // activate the layout
      await ContentLayoutManager.setActiveLayout(contentLayoutDef, contentGroup);

      // emphasize the elements
      expect(SavedViewLayout.emphasizeElementsFromProps(contentGroup, savedViewLayoutProps)).to.be.true;
    }
  });

  it("should create and parse Sheet saved view layout", async () => {
    const vs = SheetViewState.createFromProps(viewStateProps3, imodelMock.object);
    imodelMock.setup(async (x) => x.findClassFor(moq.It.isAny(), moq.It.isAny())).returns(async () => Promise.resolve<any>(SheetViewState));

    if (vs)
      viewState = vs;
    else
      throw Error("Couldn't create ViewState");

    let serializedSavedViewLayoutProps = "";

    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);

    if (frontstageDef) {
      if (ContentLayoutManager.activeLayout && ContentLayoutManager.activeContentGroup) {
        const savedViewLayoutProps = SavedViewLayout.viewLayoutToProps(ContentLayoutManager.activeLayout, ContentLayoutManager.activeContentGroup, true,
          (contentProps: ContentProps) => {
            if (contentProps.applicationData)
              delete contentProps.applicationData;
          });
        const serialized = JSON.stringify(savedViewLayoutProps);

        serializedSavedViewLayoutProps = serialized;
      }
    }

    const iModelConnection = imodelMock.object;
    if (serializedSavedViewLayoutProps && iModelConnection) {
      // Parse SavedViewLayoutProps
      const savedViewLayoutProps: SavedViewLayoutProps = JSON.parse(serializedSavedViewLayoutProps);
      // Create ContentLayoutDef
      const contentLayoutDef = new ContentLayoutDef(savedViewLayoutProps.contentLayoutProps ?? savedViewLayoutProps.contentGroupProps.layout);
      // Create ViewStates
      const viewStates = await SavedViewLayout.viewStatesFromProps(iModelConnection, savedViewLayoutProps);

      expect(contentLayoutDef.description).to.eq("Single Content View");
      expect(viewStates.length).to.eq(1);

      const viewState0 = viewStates[0];
      if (viewState0) {
        const bisBaseName = ViewUtilities.getBisBaseClass(viewState0.classFullName);
        expect(ViewUtilities.isSheet(bisBaseName)).to.be.true;
      }
    }

  });

});
