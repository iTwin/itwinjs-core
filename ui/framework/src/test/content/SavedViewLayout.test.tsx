/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as moq from "typemoq";
import { expect } from "chai";

import {
  ScreenViewport, MockRender, IModelConnection, SpatialViewState, ViewState, SubCategoriesCache, DrawingViewState, SheetViewState,
} from "@bentley/imodeljs-frontend";
import {
  SpatialViewDefinitionProps, ViewStateProps, CategorySelectorProps, ModelSelectorProps, DisplayStyleProps, ViewDefinition2dProps, SheetProps,
} from "@bentley/imodeljs-common";
import { Vector3d, Point3d } from "@bentley/geometry-core";

import {
  ViewportContentControl, ConfigurableCreateInfo, FrontstageProvider, ContentLayoutDef, FrontstageProps,
  ContentGroup, Frontstage, CoreTools, Zone, Widget, NavigationWidget, FrontstageManager, ContentLayoutManager,
  SavedViewLayout, ContentProps, SavedViewLayoutProps, ConfigurableUiManager,
} from "../../ui-framework";
import TestUtils from "../TestUtils";
import { ViewUtilities } from "../../ui-framework/utils/ViewUtilities";

describe("SavedViewLayout", () => {

  const extents = Vector3d.create(400, 400);
  const origin = Point3d.createZero();
  const delta = Point3d.createZero();

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const viewsMock = moq.Mock.ofType<IModelConnection.Views>();

  imodelMock.setup((x) => x.views).returns(() => viewsMock.object);
  imodelMock.setup((x) => x.subcategories).returns(() => new SubCategoriesCache(imodelMock.object));
  imodelMock.setup((x) => x.models).returns(() => new IModelConnection.Models(imodelMock.object));

  const viewDefinitionProps1: SpatialViewDefinitionProps = {
    cameraOn: false, origin, extents,
    camera: { lens: 0, focusDist: 1, eye: [0, 0, 0] },
    classFullName: "Bis:SpatialViewDefinition",
    id: "id1",
    modelSelectorId: "id1", categorySelectorId: "id1", displayStyleId: "id1",
    model: "model", code: { spec: "spec", scope: "scope" },
  };

  const viewDefinitionProps2: ViewDefinition2dProps = {
    cameraOn: false, origin, extents,
    camera: { lens: 0, focusDist: 1, eye: [0, 0, 0] },
    classFullName: "Bis:DrawingViewDefinition",
    id: "id1",
    categorySelectorId: "id1", displayStyleId: "id1",
    model: "model", code: { spec: "spec", scope: "scope" },
    baseModelId: "model", delta, angle: 0,
  };

  const viewDefinitionProps3: ViewDefinition2dProps = {
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
  viewportMock.setup((x) => x.view).returns(() => viewState);

  before(async () => {
    await TestUtils.initializeUiFramework();
    MockRender.App.startup();

    // Required for SavedViewLayout
    ConfigurableUiManager.registerControl("TestViewport", TestViewportContentControl);
  });

  after(() => {
    MockRender.App.shutdown();
  });

  class TestViewportContentControl extends ViewportContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = <div />;

      this.viewport = viewportMock.object;
    }
  }
  class Frontstage1 extends FrontstageProvider {

    public contentLayoutDef: ContentLayoutDef = new ContentLayoutDef(
      {
        id: "SingleContent",
        descriptionKey: "App:ContentLayoutDef.SingleContent",
        priority: 100,
      },
    );

    public get frontstage(): React.ReactElement<FrontstageProps> {

      const myContentGroup: ContentGroup = new ContentGroup(
        {
          id: "MyContentGroup",
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
          id="Test1"
          defaultTool={CoreTools.selectElementCommand}
          defaultLayout={this.contentLayoutDef}
          contentGroup={myContentGroup}

          topRight={
            <Zone widgets={[
              <Widget isFreeform={true} element={<NavigationWidget />} />,
            ]} />
          }
        />
      );
    }
  }

  beforeEach(async () => {
    FrontstageManager.clearFrontstageDefs();
  });

  it("should create and parse Spatial saved view layout", async () => {
    const vs = SpatialViewState.createFromProps(viewStateProps1, imodelMock.object);
    if (vs)
      viewState = vs;
    else
      throw Error("Couldn't create ViewState");

    let serializedSavedViewLayoutProps = "";

    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);

    if (frontstageProvider.frontstageDef) {
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
      const contentLayoutDef = new ContentLayoutDef(savedViewLayoutProps.contentLayoutProps);
      // Create ViewStates
      const viewStates = await SavedViewLayout.viewStatesFromProps(iModelConnection, savedViewLayoutProps);

      expect(contentLayoutDef.descriptionKey).to.eq("App:ContentLayoutDef.SingleContent");
      expect(viewStates.length).to.eq(1);

      const viewState0 = viewStates[0];
      if (viewState0) {
        const bisBaseName = ViewUtilities.getBisBaseClass(viewState0.classFullName);
        expect(ViewUtilities.isSpatial(bisBaseName)).to.be.true;
      }
    }
  });

  it("should create and parse Drawing saved view layout", async () => {
    const vs = DrawingViewState.createFromProps(viewStateProps2, imodelMock.object);
    if (vs)
      viewState = vs;
    else
      throw Error("Couldn't create ViewState");

    let serializedSavedViewLayoutProps = "";

    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);

    if (frontstageProvider.frontstageDef) {
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
      const contentLayoutDef = new ContentLayoutDef(savedViewLayoutProps.contentLayoutProps);
      // Create ViewStates
      const viewStates = await SavedViewLayout.viewStatesFromProps(iModelConnection, savedViewLayoutProps);

      expect(contentLayoutDef.descriptionKey).to.eq("App:ContentLayoutDef.SingleContent");
      expect(viewStates.length).to.eq(1);

      const viewState0 = viewStates[0];
      if (viewState0) {
        const bisBaseName = ViewUtilities.getBisBaseClass(viewState0.classFullName);
        expect(ViewUtilities.isDrawing(bisBaseName)).to.be.true;
      }

      const contentGroup = new ContentGroup(savedViewLayoutProps.contentGroupProps);
      expect(contentGroup.groupId).to.eq("MyContentGroup");

      // activate the layout
      await ContentLayoutManager.setActiveLayout(contentLayoutDef, contentGroup);

      // emphasize the elements
      SavedViewLayout.emphasizeElementsFromProps(contentGroup, savedViewLayoutProps);
    }

  });

  it("should create and parse Sheet saved view layout", async () => {
    const vs = SheetViewState.createFromProps(viewStateProps3, imodelMock.object);
    if (vs)
      viewState = vs;
    else
      throw Error("Couldn't create ViewState");

    let serializedSavedViewLayoutProps = "";

    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);

    if (frontstageProvider.frontstageDef) {
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
      const contentLayoutDef = new ContentLayoutDef(savedViewLayoutProps.contentLayoutProps);
      // Create ViewStates
      const viewStates = await SavedViewLayout.viewStatesFromProps(iModelConnection, savedViewLayoutProps);

      expect(contentLayoutDef.descriptionKey).to.eq("App:ContentLayoutDef.SingleContent");
      expect(viewStates.length).to.eq(1);

      const viewState0 = viewStates[0];
      if (viewState0) {
        const bisBaseName = ViewUtilities.getBisBaseClass(viewState0.classFullName);
        expect(ViewUtilities.isSheet(bisBaseName)).to.be.true;
      }
    }

  });

});
