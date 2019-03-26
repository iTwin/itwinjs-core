/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as moq from "typemoq";
import { expect } from "chai";
import { mount } from "enzyme";

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
  CoreTools,
  ContentViewManager,
  AnalysisAnimationTool,
} from "../../ui-framework";

import { ScreenViewport, ViewState3d } from "@bentley/imodeljs-frontend";

describe("AnalysisAnimationToolSettings", () => {

  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const viewMock = moq.Mock.ofType<ViewState3d>();

  class TestViewportContentControl extends ViewportContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = <div />;

      this.viewport = viewportMock.object;
    }
  }

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  const saveDef = window.cancelAnimationFrame;

  beforeEach(() => {
    // avoid error about cancelAnimationFrame not being a function when running test
    window.cancelAnimationFrame = (_handle: number) => {
    };

    viewMock.reset();
    viewMock.setup((view) => view.classFullName).returns(() => "SheetViewDefinition");
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => viewMock.object);
  });

  afterEach(() => {
    window.cancelAnimationFrame = saveDef;
  });

  it("show tool settings", () => {
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
          />
        );
      }
    }

    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef).then(() => { // tslint:disable-line:no-floating-promises
      if (frontstageProvider.frontstageDef) {
        const contentControl = ContentViewManager.getActiveContentControl();
        expect(contentControl).to.not.be.undefined;

        if (contentControl) {
          expect(contentControl.isViewport).to.be.true;
          expect(contentControl.viewport).to.not.be.undefined;

          FrontstageManager.setActiveToolId(AnalysisAnimationTool.toolId);
          expect(FrontstageManager.activeToolId).to.eq(AnalysisAnimationTool.toolId);

          const toolInformation = FrontstageManager.activeToolInformation;
          expect(toolInformation).to.not.be.undefined;

          if (toolInformation) {
            const toolUiProvider = toolInformation.toolUiProvider;
            expect(toolUiProvider).to.not.be.undefined;

            if (toolUiProvider) {
              expect(toolUiProvider.toolSettingsNode).to.not.be.undefined;
            }
          }

          const toolSettingsNode = FrontstageManager.activeToolSettingsNode;
          expect(toolSettingsNode).to.not.be.undefined;

          const wrapper = mount(toolSettingsNode as React.ReactElement<any>);
          expect(wrapper).to.not.be.undefined;

          const durationItem = wrapper.find("#animationDuration");
          expect(durationItem.length).to.eq(1);
          durationItem.simulate("change", { target: { value: "15" } });
          expect(wrapper.state("animationDuration")).to.eq(15000);

          const loopItem = wrapper.find("#animationLoop");
          expect(loopItem.length).to.eq(1);
          loopItem.simulate("change", { target: { checked: false } });
          expect(wrapper.state("isLooping")).to.eq(false);

          // all the other items require an active content control
          wrapper.unmount();
        }
      }
    });
  });
});
