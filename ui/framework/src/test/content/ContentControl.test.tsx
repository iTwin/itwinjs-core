/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { expect } from "chai";
import * as React from "react";
import {
  ContentGroup,
  ContentLayoutDef,
  ContentControl,
  ConfigurableCreateInfo,
  ConfigurableUiManager,
  FrontstageManager,
  ContentViewManager,
  FrontstageProvider,
  FrontstageProps,
  Frontstage,
  CoreTools,
} from "../../ui-framework";
import TestUtils from "../TestUtils";

describe("ContentControl", () => {

  class TestContentControl extends ContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = <div />;
    }
  }

  before(async () => {
    await TestUtils.initializeUiFramework();
    ConfigurableUiManager.registerControl("TestContentControl", TestContentControl);
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("activated", async () => {
    const myContentGroup: ContentGroup = new ContentGroup({
      id: "myContentGroup",
      contents: [
        { classId: TestContentControl, applicationData: "data1" },
        { classId: TestContentControl, applicationData: "data2" },
      ],
    });

    const myContentLayout: ContentLayoutDef = new ContentLayoutDef({
      id: "SingleContent",
      descriptionKey: "UiFramework:tests.singleContent",
      priority: 100,
    });

    class Frontstage1 extends FrontstageProvider {
      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id="ContentFrontstage1"
            defaultTool={CoreTools.selectElementCommand}
            defaultLayout={myContentLayout}
            contentGroup={myContentGroup}
          />
        );
      }
    }
    ConfigurableUiManager.addFrontstageProvider(new Frontstage1());

    const frontstageDef = ConfigurableUiManager.findFrontstageDef("ContentFrontstage1");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      await FrontstageManager.setActiveFrontstageDef(frontstageDef);
      const contentGroup = frontstageDef.contentGroup;
      expect(contentGroup).to.not.be.undefined;

      if (contentGroup) {
        const contentSet = contentGroup.getContentNodes();
        expect(contentSet.length).to.eq(2);

        const contentControl = contentGroup.getControlFromElement(contentSet[1]);
        expect(contentControl).to.not.be.undefined;

        if (contentControl) {
          const activatedMethod = sinon.spy(contentControl, "onActivated");
          ContentViewManager.setActiveContent(contentSet[1]);
          expect(activatedMethod.calledOnce, `onActivated called ${activatedMethod.callCount} times`).to.be.true;

          expect(contentControl.isViewport).to.be.false;
          expect(contentControl.viewport).to.be.undefined;
          expect(contentControl.navigationAidControl.length).to.eq(0);
        }
      }
    }
  });

  it("deactivated", async () => {
    const contentGroup2: ContentGroup = new ContentGroup({
      id: "contentGroup2",
      contents: [
        { classId: TestContentControl, applicationData: "data1" },
        { classId: TestContentControl, applicationData: "data2" },
      ],
    });

    const contentLayout2: ContentLayoutDef = new ContentLayoutDef({
      id: "TwoHalvesVertical",
      descriptionKey: "App:ContentLayoutDef.TwoHalvesVertical",
      priority: 60,
      verticalSplit: { id: "TwoHalvesVertical.VerticalSplit", percentage: 0.50, left: 0, right: 1 },
    });

    class Frontstage2 extends FrontstageProvider {
      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id="ContentFrontstage2"
            defaultTool={CoreTools.selectElementCommand}
            defaultLayout={contentLayout2}
            contentGroup={contentGroup2}
          />
        );
      }
    }
    ConfigurableUiManager.addFrontstageProvider(new Frontstage2());

    const frontstageDef = ConfigurableUiManager.findFrontstageDef("ContentFrontstage2");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      await FrontstageManager.setActiveFrontstageDef(frontstageDef);
      const contentGroup = frontstageDef.contentGroup;
      expect(contentGroup).to.not.be.undefined;

      if (contentGroup) {
        const contentSet = contentGroup.getContentNodes();
        expect(contentSet.length).to.eq(2);

        const contentControl = contentGroup.getControlFromElement(contentSet[0]);
        expect(contentControl).to.not.be.undefined;

        if (contentControl) {
          const deactivatedMethod = sinon.spy(contentControl, "onDeactivated");
          ContentViewManager.setActiveContent(contentSet[1]);
          expect(deactivatedMethod.calledOnce).to.be.true;

          const activatedMethod = sinon.spy(contentControl, "onActivated");
          ContentViewManager.refreshActiveContent(contentSet[0]);
          expect(activatedMethod.calledOnce).to.be.true;
        }
      }
    }
  });

});
