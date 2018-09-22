/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import {
  ContentLayout,
  ContentGroup,
  ContentLayoutDef,
  ContentControl,
  ConfigurableCreateInfo,
  ConfigurableUiManager,
} from "../../src/index";
import TestUtils from "../TestUtils";

describe("ContentLayout", () => {

  class TestContentControl extends ContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = <div />;
    }
  }

  before(async () => {
    await TestUtils.initializeUiFramework();
    ConfigurableUiManager.registerControl("TestContentControl2", TestContentControl);
  });

  const myContentGroup: ContentGroup = new ContentGroup({
    contents: [{ classId: "TestContentControl2" }],
  });

  const myContentLayout: ContentLayoutDef = new ContentLayoutDef({
    id: "SingleContent",
    descriptionKey: "UiFramework:tests.singleContent",
    priority: 100,
  });

  it("SingleContent should render", () => {
    mount(<ContentLayout contentGroup={myContentGroup} contentLayout={myContentLayout} isInFooterMode={true} />);
  });

  it("SingleContent renders correctly", () => {
    shallow(<ContentLayout contentGroup={myContentGroup} contentLayout={myContentLayout} isInFooterMode={true} />).should.matchSnapshot();
  });

  const contentGroup2: ContentGroup = new ContentGroup({
    id: "contentGroup2",
    contents: [
      { classId: "TestContentControl2", applicationData: "data1" },
      { classId: "TestContentControl2", applicationData: "data2" },
    ],
  });

  const contentLayout2: ContentLayoutDef = new ContentLayoutDef({
    id: "TwoHalvesVertical",
    descriptionKey: "Protogist:ContentLayoutDef.TwoHalvesVertical",
    priority: 60,
    verticalSplit: { id: "TwoHalvesVertical.VerticalSplit", percentage: 0.50, left: 0, right: 1 },
  });

  // NEEDSWORK: Results in
  // Invariant Violation: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined.
  it.skip("TwoHalvesVertical should render", () => {
    mount(<ContentLayout contentGroup={contentGroup2} contentLayout={contentLayout2} isInFooterMode={true} />);
  });

  it("TwoHalvesVertical renders correctly", () => {
    shallow(<ContentLayout contentGroup={contentGroup2} contentLayout={contentLayout2} isInFooterMode={true} />).should.matchSnapshot();
  });

  const contentLayout3: ContentLayoutDef = new ContentLayoutDef({
    id: "TwoHalvesHorizontal",
    descriptionKey: "Protogist:ContentLayoutDef.TwoHalvesHorizontal",
    priority: 60,
    horizontalSplit: { id: "TwoHalvesHorizontal.HorizontalSplit", percentage: 0.50, top: 0, bottom: 1 },
  });

  // NEEDSWORK: Results in
  // Invariant Violation: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined.
  it.skip("TwoHalvesHorizontal should render", () => {
    mount(<ContentLayout contentGroup={contentGroup2} contentLayout={contentLayout3} isInFooterMode={false} />);
  });

  it("TwoHalvesHorizontal renders correctly", () => {
    shallow(<ContentLayout contentGroup={contentGroup2} contentLayout={contentLayout3} isInFooterMode={false} />).should.matchSnapshot();
  });

});
