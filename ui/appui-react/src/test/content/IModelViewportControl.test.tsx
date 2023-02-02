/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import * as React from "react";
import * as moq from "typemoq";
import { render } from "@testing-library/react";
import { MockRender, ScreenViewport, ViewState3d } from "@itwin/core-frontend";
import {
  ConfigurableCreateInfo, ConfigurableUiControlType, ContentGroup,
  CoreTools, Frontstage, FrontstageProps, FrontstageProvider, IModelViewportControl, IModelViewportControlOptions,
  NavigationWidget, SupportsViewSelectorChange, UiFramework, Widget, Zone,
} from "../../appui-react";
import TestUtils, { storageMock } from "../TestUtils";
import { StandardContentLayouts } from "@itwin/appui-abstract";
import { InternalFrontstageManager } from "../../appui-react/frontstage/InternalFrontstageManager";

const mySessionStorage = storageMock();
const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(window, "sessionStorage")!;

describe("IModelViewportControl", () => {

  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const viewMock = moq.Mock.ofType<ViewState3d>();

  before(async () => {
    Object.defineProperty(window, "sessionStorage", {
      get: () => mySessionStorage,
    });

    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();

    InternalFrontstageManager.isInitialized = false;
    InternalFrontstageManager.initialize();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();

    // restore the overriden property getter
    Object.defineProperty(window, "sessionStorage", propertyDescriptorToRestore);
  });

  class TestViewportContentControl extends IModelViewportControl {
    public static override get id() {
      return "TestApp.IModelViewport";
    }

    constructor(info: ConfigurableCreateInfo, options: IModelViewportControlOptions) {
      super(info, { ...options, deferNodeInitialization: true });  // force deferNodeInitialization for subclass
      this.setIsReady();
    }

    protected override _getViewOverlay = (_viewport: ScreenViewport): React.ReactNode => {
      return <div data-testid="ViewOverlay">ViewOverlay</div>;
    };

    protected override initializeReactNode() {
      this._reactNode = <div data-testid="MainContent">
        {this._getViewOverlay(this.viewport!)}
      </div >;
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
          id: "test",
          layout: StandardContentLayouts.singleView,
          contents: [
            {
              id: "main",
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

    UiFramework.frontstages.clearFrontstageProviders();
    await UiFramework.frontstages.setActiveFrontstageDef(undefined);
  });

  it("Overridden IModelViewportControl should deferNodeInitialization", async () => {
    const frontstageProvider = new Frontstage1();
    UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await UiFramework.frontstages.getFrontstageDef(Frontstage1.stageId);
    await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);

    if (frontstageDef) {
      expect(UiFramework.content.layouts.activeLayout).to.exist;

      const contentControl = UiFramework.content.getActiveContentControl();
      expect(contentControl).to.not.be.undefined;
      expect(contentControl instanceof TestViewportContentControl).to.be.true;

      if (contentControl) {
        expect(contentControl.isViewport).to.be.true;
        expect(contentControl.viewport).to.not.be.undefined;
        expect(contentControl.getType()).to.eq(ConfigurableUiControlType.Viewport);

        const supportsContentControl = contentControl as unknown as SupportsViewSelectorChange;
        expect(supportsContentControl.supportsViewSelectorChange).to.be.true;

        const controlNode = (contentControl as TestViewportContentControl).reactNode;
        expect(controlNode).to.not.be.undefined;
        expect(React.isValidElement(controlNode)).to.be.true;

        const componentWrapper = render(controlNode as React.ReactElement);
        expect(componentWrapper).to.not.be.undefined;
        expect(componentWrapper.getByTestId("MainContent")).to.not.be.undefined;
        expect(componentWrapper.getByTestId("ViewOverlay")).to.not.be.undefined;
      }
    }
  });

});
