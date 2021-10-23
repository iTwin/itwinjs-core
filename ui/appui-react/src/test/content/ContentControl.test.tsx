/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { StandardContentLayouts } from "@itwin/appui-abstract";
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import {
  ConfigurableCreateInfo, ConfigurableUiManager, ContentControl, ContentGroup, ContentViewManager, CoreTools, Frontstage,
  FrontstageManager, FrontstageProps, FrontstageProvider,
} from "../../appui-react";
import TestUtils from "../TestUtils";

describe("ContentControl", () => {

  class TestContentControl extends ContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = <div />;
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
      layout: StandardContentLayouts.singleView,
      contents: [
        { id: "main", classId: TestContentControl, applicationData: "data1" },
        { id: "secondary", classId: TestContentControl, applicationData: "data2" },
      ],
    });

    class Frontstage1 extends FrontstageProvider {
      public static stageId = "ContentFrontstage1";
      public get id(): string {
        return Frontstage1.stageId;
      }

      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id={this.id}
            defaultTool={CoreTools.selectElementCommand}
            contentGroup={myContentGroup}
          />
        );
      }
    }
    ConfigurableUiManager.addFrontstageProvider(new Frontstage1());

    const frontstageDef = await FrontstageManager.getFrontstageDef(Frontstage1.stageId);
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
      layout: StandardContentLayouts.twoHorizontalSplit,
      contents: [
        { id: "main", classId: TestContentControl, applicationData: "data1" },
        { id: "secondary", classId: TestContentControl, applicationData: "data2" },
      ],
    });

    class Frontstage2 extends FrontstageProvider {
      public static stageId = "ContentFrontstage2";
      public get id(): string {
        return Frontstage2.stageId;
      }

      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id={this.id}
            defaultTool={CoreTools.selectElementCommand}
            contentGroup={contentGroup2}
          />
        );
      }
    }
    ConfigurableUiManager.addFrontstageProvider(new Frontstage2());

    const frontstageDef = await FrontstageManager.getFrontstageDef(Frontstage2.stageId);
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
