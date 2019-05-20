/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as moq from "typemoq";
import { expect } from "chai";

import TestUtils from "../TestUtils";
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
} from "../../ui-framework";
import { ScreenViewport, ViewState3d } from "@bentley/imodeljs-frontend";
import { ViewportComponentEvents } from "@bentley/ui-components";
import sinon = require("sinon");
import { NavigationWidget } from "../../ui-framework/widgets/NavigationWidget";
import { mount } from "enzyme";
import { SupportsViewSelectorChange } from "../../ui-framework/content/ContentControl";

describe("ViewportContentControl", () => {

  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const viewMock = moq.Mock.ofType<ViewState3d>();

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
              <Widget isFreeform={true} element={<NavigationWidget />} />,
            ]} />
          }
        />
      );
    }
  }

  before(async () => {
    await TestUtils.initializeUiFramework();
    await FrontstageManager.setActiveFrontstageDef(undefined);
  });

  beforeEach(async () => {
    viewMock.reset();
    viewMock.setup((view) => view.classFullName).returns(() => "SheetViewDefinition");
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => viewMock.object);

    FrontstageManager.clearFrontstageDefs();
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

});
