/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
  FrontstageProps,
  FrontstageManager,
  ContentViewManager,
} from "../../src/index";
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

  const myContentGroup: ContentGroup = new ContentGroup({
    id: "myContentGroup",
    contents: [
      { classId: "TestContentControl" },
    ],
  });

  const myContentLayout: ContentLayoutDef = new ContentLayoutDef({
    id: "SingleContent",
    descriptionKey: "UiFramework:tests.singleContent",
    priority: 100,
  });

  const frontstageProps: FrontstageProps = {
    id: "TestFrontstage1",
    defaultToolId: "PlaceLine",
    defaultLayout: myContentLayout,
    contentGroup: myContentGroup,
  };

  it("activated", () => {
    ConfigurableUiManager.loadFrontstage(frontstageProps);
    const frontstageDef = ConfigurableUiManager.findFrontstageDef("TestFrontstage1");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      FrontstageManager.setActiveFrontstageDef(frontstageDef);
      const contentGroup = frontstageDef.contentGroup;
      expect(contentGroup).to.not.be.undefined;

      if (contentGroup) {
        const contentSet = contentGroup.getContentNodes();
        expect(contentSet.length).to.eq(1);

        const contentControl = contentGroup.getControlFromElement(contentSet[0]);
        expect(contentControl).to.not.be.undefined;

        if (contentControl) {
          const activatedMethod = sinon.spy(contentControl, "onActivated");
          ContentViewManager.setActiveContent(contentSet[0]);
          expect(activatedMethod.calledOnce).to.be.true;
        }
      }
    }
  });

  const contentGroup2: ContentGroup = new ContentGroup({
    id: "contentGroup2",
    contents: [
      { classId: "TestContentControl", applicationData: "data1" },
      { classId: "TestContentControl", applicationData: "data2" },
    ],
  });

  const contentLayout2: ContentLayoutDef = new ContentLayoutDef({
    id: "TwoHalvesVertical",
    descriptionKey: "Protogist:ContentLayoutDef.TwoHalvesVertical",
    priority: 60,
    verticalSplit: { id: "TwoHalvesVertical.VerticalSplit", percentage: 0.50, left: 0, right: 1 },
  });

  const frontstageProps2: FrontstageProps = {
    id: "TestFrontstage2",
    defaultToolId: "PlaceLine",
    defaultLayout: contentLayout2,
    contentGroup: contentGroup2,
  };

  it("deactivated", () => {
    ConfigurableUiManager.loadFrontstage(frontstageProps2);
    const frontstageDef = ConfigurableUiManager.findFrontstageDef("TestFrontstage2");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      FrontstageManager.setActiveFrontstageDef(frontstageDef);
      const contentGroup = frontstageDef.contentGroup;
      expect(contentGroup).to.not.be.undefined;

      if (contentGroup) {
        const contentSet = contentGroup.getContentNodes();
        expect(contentSet.length).to.eq(2);

        const contentControl = contentGroup.getControlFromElement(contentSet[0]);
        expect(contentControl).to.not.be.undefined;

        if (contentControl) {
          const activatedMethod = sinon.spy(contentControl, "onActivated");
          ContentViewManager.setActiveContent(contentSet[0]);
          expect(activatedMethod.calledOnce).to.be.true;

          const deactivatedMethod = sinon.spy(contentControl, "onDeactivated");
          ContentViewManager.setActiveContent(contentSet[1]);
          expect(deactivatedMethod.calledOnce).to.be.true;
        }
      }
    }
  });

});
