/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import * as React from "react";
import {
  ContentLayout,
  ContentGroup,
  ContentLayoutDef,
  ContentControl,
  ConfigurableCreateInfo,
  ContentViewManager,
  ContentLayoutProps,
  ContentLayoutManager,
} from "../../ui-framework";
import TestUtils from "../TestUtils";

describe("ContentLayout", () => {

  class TestContentControl extends ContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = <div>Test</div>;
    }
  }

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  const myContentGroup: ContentGroup = new ContentGroup({
    contents: [{ id: "myContent", classId: TestContentControl }],
  });

  const myContentLayout: ContentLayoutDef = new ContentLayoutDef({
    id: "SingleContent",
    descriptionKey: "UiFramework:tests.singleContent",
    priority: 100,
  });

  it("SingleContent should render", () => {
    const wrapper = mount(<ContentLayout contentGroup={myContentGroup} contentLayout={myContentLayout} isInFooterMode={true} />);
    wrapper.unmount();
  });

  it("SingleContent renders correctly", () => {
    shallow(<ContentLayout contentGroup={myContentGroup} contentLayout={myContentLayout} isInFooterMode={true} />).should.matchSnapshot();
  });

  const contentGroup2: ContentGroup = new ContentGroup({
    id: "contentGroup2",
    contents: [
      { classId: TestContentControl, applicationData: "data1" },
      { classId: TestContentControl, applicationData: "data2" },
      { classId: TestContentControl, applicationData: "data3" },
      { classId: TestContentControl, applicationData: "data4" },
    ],
  });

  const contentLayout2: ContentLayoutDef = new ContentLayoutDef({
    id: "TwoHalvesVertical",
    descriptionKey: "SampleApp:ContentLayoutDef.TwoHalvesVertical",
    priority: 60,
    verticalSplit: { id: "TwoHalvesVertical.VerticalSplit", percentage: 0.50, left: 0, right: 1 },
  });

  it("TwoHalvesVertical should render", () => {
    const wrapper = mount(<ContentLayout contentGroup={contentGroup2} contentLayout={contentLayout2} isInFooterMode={true} />);
    wrapper.unmount();
  });

  it("TwoHalvesVertical renders correctly", () => {
    shallow(<ContentLayout contentGroup={contentGroup2} contentLayout={contentLayout2} isInFooterMode={true} />).should.matchSnapshot();
  });

  const contentLayout3: ContentLayoutDef = new ContentLayoutDef({
    id: "TwoHalvesHorizontal",
    descriptionKey: "SampleApp:ContentLayoutDef.TwoHalvesHorizontal",
    priority: 60,
    horizontalSplit: { id: "TwoHalvesHorizontal.HorizontalSplit", percentage: 0.50, top: 0, bottom: 1 },
  });

  it("TwoHalvesHorizontal should render", () => {
    const wrapper = mount(<ContentLayout contentGroup={contentGroup2} contentLayout={contentLayout3} isInFooterMode={false} />);
    wrapper.unmount();
  });

  it("TwoHalvesHorizontal renders correctly", () => {
    shallow(<ContentLayout contentGroup={contentGroup2} contentLayout={contentLayout3} isInFooterMode={false} />).should.matchSnapshot();
  });

  const fourQuadrantsVerticalLayoutDef: ContentLayoutDef = new ContentLayoutDef(
    { // Four Views, two stacked on the left, two stacked on the right.
      id: "fourQuadrantsVertical",
      descriptionKey: "SampleApp:ContentLayoutDef.FourQuadrants",
      priority: 85,
      verticalSplit: {
        percentage: 0.50,
        lock: true,
        left: { horizontalSplit: { percentage: 0.50, top: 0, bottom: 1, lock: true } },
        right: { horizontalSplit: { percentage: 0.50, top: 2, bottom: 3, lock: true } },
      },
    },
  );

  it("FourQuadrantsVertical should render", () => {
    const wrapper = mount(<ContentLayout contentGroup={contentGroup2} contentLayout={fourQuadrantsVerticalLayoutDef} isInFooterMode={false} />);
    wrapper.unmount();
  });

  it("FourQuadrantsVertical renders correctly", () => {
    shallow(<ContentLayout contentGroup={contentGroup2} contentLayout={fourQuadrantsVerticalLayoutDef} isInFooterMode={false} />).should.matchSnapshot();
  });

  const fourQuadrantsHorizontalLayoutDef: ContentLayoutDef = new ContentLayoutDef(
    { // Four Views, two stacked on the left, two stacked on the right.
      descriptionKey: "SampleApp:ContentLayoutDef.FourQuadrants",
      priority: 85,
      featureId: "test",
      horizontalSplit: {
        percentage: 0.50,
        lock: true,
        top: { verticalSplit: { percentage: 0.50, left: 0, right: 1, lock: true } },
        bottom: { verticalSplit: { percentage: 0.50, left: 2, right: 3, lock: true } },
      },
    },
  );

  it("FourQuadrantsHorizontal should render", () => {
    const wrapper = mount(<ContentLayout contentGroup={contentGroup2} contentLayout={fourQuadrantsHorizontalLayoutDef} isInFooterMode={false} />);
    wrapper.unmount();
  });

  it("FourQuadrantsVertical renders correctly", () => {
    shallow(<ContentLayout contentGroup={contentGroup2} contentLayout={fourQuadrantsHorizontalLayoutDef} isInFooterMode={false} />).should.matchSnapshot();
  });

  it("ContentLayoutDiv mouse down and up", () => {
    const wrapper = mount(<ContentLayout contentGroup={myContentGroup} contentLayout={myContentLayout} isInFooterMode={true} />);
    const layoutDiv = wrapper.find("#uifw-contentlayout-div");
    layoutDiv.simulate("mouseDown");
    expect(ContentViewManager.isMouseDown).to.be.true;
    layoutDiv.simulate("mouseUp");
    expect(ContentViewManager.isMouseDown).to.be.false;
    wrapper.unmount();
  });

  it("ContentWrapper mouse down", () => {
    const wrapper = mount(<ContentLayout contentGroup={contentGroup2} contentLayout={contentLayout2} isInFooterMode={true} />);

    const layoutWrappers = wrapper.find("div.uifw-contentlayout-wrapper");
    expect(layoutWrappers.length).to.eq(2);
    expect(wrapper.find("div.uifw-contentlayout-overlay-active").length).to.eq(0);

    layoutWrappers.at(0).simulate("mouseDown");
    wrapper.update();
    expect(wrapper.find("div.uifw-contentlayout-overlay-active").length).to.eq(1);

    wrapper.unmount();
  });

  it("SplitPane onChanged", () => {
    const wrapper = mount(
      <div style={{ width: "100px", height: "100px" }}>
        <ContentLayout contentGroup={contentGroup2} contentLayout={contentLayout2} isInFooterMode={true} />
      </div>);

    const resizer = wrapper.find("span.Resizer");
    expect(resizer.length).to.eq(1);

    const top = document.documentElement;
    expect(top).to.not.be.null;

    // TODO: This is not triggering onChange as expected
    if (top) {
      resizer.simulate("mousedown");

      const mouseMove = new Event("mousemove");  // creates a new event
      top.dispatchEvent(mouseMove);              // dispatches it
      const mouseUp = new Event("mouseup");
      top.dispatchEvent(mouseUp);

      wrapper.update();
    }

    wrapper.unmount();
  });

  it("ContentLayoutManager.loadLayout should throw Error if ContentLayoutProps does not have an id", () => {
    const layoutProps: ContentLayoutProps = {
      descriptionKey: "UiFramework:tests.singleContent",
      priority: 100,
    };
    expect(() => ContentLayoutManager.loadLayout(layoutProps)).to.throw(Error);
  });

});
