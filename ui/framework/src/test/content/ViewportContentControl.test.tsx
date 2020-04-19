/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as moq from "typemoq";
import * as sinon from "sinon";
import { expect } from "chai";
import { mount } from "enzyme";

import { ScreenViewport, ViewState3d, MockRender } from "@bentley/imodeljs-frontend";
import { ViewportComponentEvents } from "@bentley/ui-components";

import TestUtils, { storageMock } from "../TestUtils";
import {
  ViewportContentControl,
  ConfigurableCreateInfo,
  Frontstage,
  FrontstageManager,
  FrontstageProvider,
  ContentGroup,
  FrontstageProps,
  ContentLayoutDef,
  ConfigurableUiControlType,
  ContentViewManager,
  ContentLayoutManager,
  CoreTools,
  Zone,
  Widget,
  FrontstageComposer,
  NavigationWidget,
  SupportsViewSelectorChange,
  ConfigurableUiManager,
} from "../../ui-framework";

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
    MockRender.App.startup();

    ConfigurableUiManager.initialize();
    FrontstageManager.isInitialized = false;
    FrontstageManager.initialize();
  });

  after(() => {
    MockRender.App.shutdown();
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

    public get viewport(): ScreenViewport | undefined { return viewportMock.object; }

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
          contents: [
            {
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
              <Widget isFreeform={true} element={<NavigationWidget />} />, // tslint:disable-line:deprecation
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
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);

    if (frontstageProvider.frontstageDef) {
      expect(ContentLayoutManager.activeLayout).to.eq(frontstageProvider.contentLayoutDef);

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
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);

    if (frontstageProvider.frontstageDef) {
      expect(ContentLayoutManager.activeLayout).to.eq(frontstageProvider.contentLayoutDef);

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
    const wrapper = mount(<FrontstageComposer />);
    const spyMethod = sinon.spy();
    const remove = FrontstageManager.onNavigationAidActivatedEvent.addListener(spyMethod);

    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);

    if (frontstageProvider.frontstageDef) {
      expect(ContentLayoutManager.activeLayout).to.eq(frontstageProvider.contentLayoutDef);

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
    wrapper.unmount();
  });

  it("FrontstageManager.setActiveFrontstageDef should cause onActiveContentChangedEvent", async () => {
    const spyMethod = sinon.spy();
    const remove = ContentViewManager.onActiveContentChangedEvent.addListener(spyMethod);

    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);

    await TestUtils.flushAsyncOperations();
    expect(spyMethod.called).to.be.true;

    remove();
  });

});
