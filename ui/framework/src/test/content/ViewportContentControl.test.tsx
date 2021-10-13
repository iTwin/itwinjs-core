/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { MockRender, ScreenViewport, ViewState3d } from "@itwin/core-frontend";
import { ViewportComponentEvents } from "@itwin/imodel-components-react";
import {
  ConfigurableCreateInfo, ConfigurableUiControlType, ConfigurableUiManager, ContentGroup, ContentLayoutManager, ContentViewManager,
  CoreTools, Frontstage, FrontstageComposer, FrontstageManager, FrontstageProps, FrontstageProvider, NavigationWidget, SupportsViewSelectorChange,
  ViewportContentControl, Widget, Zone,
} from "../../appui-react";
import TestUtils, { mount, storageMock } from "../TestUtils";
import { StandardContentLayouts } from "@itwin/appui-abstract";

const mySessionStorage = storageMock();

const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(window, "sessionStorage")!;

describe("ViewportContentControl", () => {

  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const viewMock = moq.Mock.ofType<ViewState3d>();

  before(async () => {
    Object.defineProperty(window, "sessionStorage", {
      get: () => mySessionStorage,
    });

    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();

    ConfigurableUiManager.initialize();
    FrontstageManager.isInitialized = false;
    FrontstageManager.initialize();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();

    // restore the overriden property getter
    Object.defineProperty(window, "sessionStorage", propertyDescriptorToRestore);
  });

  class TestViewportContentControl extends ViewportContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = <div />;

      this.setIsReady();
    }

    public override get viewport(): ScreenViewport | undefined { return viewportMock.object; }

  }
  class Frontstage1 extends FrontstageProvider {
    public static stageId = "Test1";
    public get id(): string {
      return Frontstage1.stageId;
    }

    public get frontstage(): React.ReactElement<FrontstageProps> {

      const myContentGroup: ContentGroup = new ContentGroup(
        {
          id: "test-group",
          layout: StandardContentLayouts.singleView,
          contents: [
            {
              id: "test",
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
    viewMock.reset();
    viewMock.setup((view) => view.classFullName).returns(() => "SheetViewDefinition");
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => viewMock.object);

    FrontstageManager.clearFrontstageDefs();
    await FrontstageManager.setActiveFrontstageDef(undefined);
  });

  it("Frontstage should support ViewportContentControl", async () => {
    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.id);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);

    if (frontstageDef) {
      expect(ContentLayoutManager.activeLayout?.id).to.eq("uia:singleView");

      const contentControl = ContentViewManager.getActiveContentControl();
      expect(contentControl).to.not.be.undefined;

      if (contentControl) {
        expect(contentControl.isViewport).to.be.true;
        expect(contentControl.viewport).to.not.be.undefined;
        expect(contentControl.getType()).to.eq(ConfigurableUiControlType.Viewport);

        const supportsContentControl = contentControl as unknown as SupportsViewSelectorChange;
        expect(supportsContentControl.supportsViewSelectorChange).to.be.true;
      }
    }
  });

  it("ViewportContentControl should return proper navigation aid for class name", async () => {
    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.id);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);

    if (frontstageDef) {
      expect(ContentLayoutManager.activeLayout?.id).to.eq("uia:singleView");

      const contentControl = ContentViewManager.getActiveContentControl();
      expect(contentControl).to.not.be.undefined;

      if (contentControl) {
        expect(contentControl.navigationAidControl).to.eq("SheetNavigationAid");

        viewMock.reset();
        viewMock.setup((view) => view.classFullName).returns(() => "DrawingViewDefinition");
        expect(contentControl.navigationAidControl).to.eq("DrawingNavigationAid");

        viewMock.reset();
        viewMock.setup((view) => view.classFullName).returns(() => "SpatialViewDefinition");
        expect(contentControl.navigationAidControl).to.eq("CubeNavigationAid");

        viewMock.reset();
        viewMock.setup((view) => view.classFullName).returns(() => "OrthographicViewDefinition");
        expect(contentControl.navigationAidControl).to.eq("CubeNavigationAid");
      }
    }
  });

  it("onViewClassFullNameChangedEvent should cause a NavigationAid change", async () => {
    mount(<FrontstageComposer />);
    const spyMethod = sinon.spy();
    const remove = FrontstageManager.onNavigationAidActivatedEvent.addListener(spyMethod);

    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(Frontstage1.stageId);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);

    if (frontstageDef) {
      expect(ContentLayoutManager.activeLayout?.id).to.eq("uia:singleView");

      const contentControl = ContentViewManager.getActiveContentControl();
      expect(contentControl).to.not.be.undefined;

      await TestUtils.flushAsyncOperations();
      expect(spyMethod.calledOnce).to.be.true;

      if (contentControl) {
        ViewportComponentEvents.onViewClassFullNameChangedEvent.emit({
          viewport: viewportMock.object,
          oldName: "SheetViewDefinition",
          newName: "SpatialViewDefinition",
        });
        await TestUtils.flushAsyncOperations();
        expect(spyMethod.calledTwice).to.be.true;
      }
    }

    remove();
  });

  it("FrontstageManager.setActiveFrontstageDef should cause onActiveContentChangedEvent", async () => {
    const spyMethod = sinon.spy();
    const remove = ContentViewManager.onActiveContentChangedEvent.addListener(spyMethod);

    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(Frontstage1.stageId);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);

    await TestUtils.flushAsyncOperations();
    expect(spyMethod.called).to.be.true;

    remove();
  });

});
