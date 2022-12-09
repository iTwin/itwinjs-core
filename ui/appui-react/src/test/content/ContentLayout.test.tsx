/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { MockRender } from "@itwin/core-frontend";
import { ContentLayoutProps, StandardContentLayouts } from "@itwin/appui-abstract";
import {
  ConfigurableCreateInfo, ContentControl, ContentGroup, ContentLayout, ContentLayoutDef, ContentLayoutManager,
  ContentViewManager, CoreTools, FloatingContentControl, Frontstage, FrontstageManager, FrontstageProps, FrontstageProvider,
} from "../../appui-react";
import TestUtils, { childStructure, selectorMatches, userEvent } from "../TestUtils";
import { render, screen } from "@testing-library/react";
import { EmptyLocalization } from "@itwin/core-common";

describe("ContentLayout", () => {

  class TestContentControl extends ContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = <div>Test</div>;
    }
  }

  const singleContentGroup: ContentGroup = new ContentGroup({
    id: "testGroup",
    layout: StandardContentLayouts.singleView,
    contents: [{ id: "myContent", classId: TestContentControl, applicationData: { name: "Test" } }],
  });

  const singleContentLayout: ContentLayoutDef = new ContentLayoutDef({
    id: "SingleContent",
    description: "UiFramework:tests.singleContent",
  });

  const fourContentGroup: ContentGroup = new ContentGroup({
    id: "contentGroup2",
    layout: StandardContentLayouts.fourQuadrants,
    contents: [
      { id: "one", classId: TestContentControl, applicationData: "data1" },
      { id: "two", classId: TestContentControl, applicationData: "data2" },
      { id: "three", classId: TestContentControl, applicationData: "data3" },
      { id: "four", classId: TestContentControl, applicationData: "data4" },
    ],
  });

  const verticalSplitLayout: ContentLayoutDef = new ContentLayoutDef({
    id: "TwoHalvesVertical",
    description: "SampleApp:ContentLayoutDef.TwoHalvesVertical",
    verticalSplit: { id: "TwoHalvesVertical.VerticalSplit", percentage: 0.50, left: 0, right: 1 },
  });

  const fourQuadrantLayout: ContentLayoutDef = new ContentLayoutDef(StandardContentLayouts.fourQuadrants);

  class TestFrontstage2 extends FrontstageProvider {
    public static stageId = "TestFrontstage2";
    public get id(): string {
      return TestFrontstage2.stageId;
    }

    public get frontstage(): React.ReactElement<FrontstageProps> { // eslint-disable-line deprecation/deprecation
      return (
        <Frontstage id={this.id} defaultTool={CoreTools.selectElementCommand} // eslint-disable-line deprecation/deprecation
          contentGroup={fourContentGroup} />
      );
    }
  }
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup({ localization: new EmptyLocalization() });
    FrontstageManager.clearFrontstageProviders();

    const frontstageProvider = new TestFrontstage2();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(TestFrontstage2.stageId);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  it("SingleContent renders correctly", () => {
    render(<ContentLayout contentGroup={singleContentGroup} contentLayout={singleContentLayout} isInFooterMode={true} />);

    expect(screen.getAllByText("Test")).to.have.lengthOf(1).and.satisfy((elements: HTMLElement[]) =>
      expect(elements[0].parentElement?.style).to.include({height: "100%"})
    );
  });

  it("TwoHalvesVertical renders correctly", () => {
    render(<ContentLayout contentGroup={fourContentGroup} contentLayout={verticalSplitLayout} isInFooterMode={true} />);
    expect(screen.getAllByText("Test")).to.have.lengthOf(2).and.satisfy((elements: HTMLElement[]) => [
      expect(elements[0]).to.satisfy(selectorMatches(".SplitPane.vertical .Pane.vertical.Pane1 > .uifw-contentlayout-wrapper > div")),
      expect(elements[0].parentElement?.parentElement?.style).to.include({width: "50%"}),
      expect(elements[1]).to.satisfy(selectorMatches(".SplitPane.vertical .Pane.vertical.Pane2 > .uifw-contentlayout-wrapper > div")),
    ]);
  });

  const horizontalSplitLayout: ContentLayoutDef = new ContentLayoutDef({
    id: "TwoHalvesHorizontal",
    description: "SampleApp:ContentLayoutDef.TwoHalvesHorizontal",
    horizontalSplit: { id: "TwoHalvesHorizontal.HorizontalSplit", percentage: 0.50, top: 0, bottom: 1 },
  });

  it("TwoHalvesHorizontal renders correctly", () => {
    render(<ContentLayout contentGroup={fourContentGroup} contentLayout={horizontalSplitLayout} isInFooterMode={false} />);

    expect(screen.getAllByText("Test")).to.have.lengthOf(2).and.satisfy((elements: HTMLElement[]) => [
      expect(elements[0]).to.satisfy(selectorMatches(".SplitPane.horizontal .Pane.horizontal.Pane1 > .uifw-contentlayout-wrapper > div")),
      expect(elements[0].parentElement?.parentElement?.style).to.include({height: "50%"}),
      expect(elements[1]).to.satisfy(selectorMatches(".SplitPane.horizontal .Pane.horizontal.Pane2 > .uifw-contentlayout-wrapper > div")),
    ]);
  });

  const fourQuadrantsVerticalLayout: ContentLayoutDef = new ContentLayoutDef(
    { // Four Views, two stacked on the left, two stacked on the right.
      id: "fourQuadrantsVertical",
      verticalSplit: {
        id: "fourQuadrantsVertical",
        percentage: 0.50,
        lock: true,
        minSizeLeft: 100,
        minSizeRight: 100,
        left: { horizontalSplit: { id: "fourQuadrantsRightHorizontal", percentage: 0.50, top: 0, bottom: 1, lock: true, minSizeTop: 50, minSizeBottom: 50 } },
        right: { horizontalSplit: { id: "fourQuadrantsLeftHorizontal", percentage: 0.50, top: 2, bottom: 3, lock: true, minSizeTop: 50, minSizeBottom: 50 } },
      },
    },
  );

  it("FourQuadrantsVertical renders correctly", () => {
    render(<ContentLayout contentGroup={fourContentGroup} contentLayout={fourQuadrantsVerticalLayout} isInFooterMode={false} />);

    expect(screen.getAllByText("Test")).to.have.lengthOf(4).and.satisfy((elements: HTMLElement[]) => [
      expect(elements[0]).to.satisfy(selectorMatches(".SplitPane.vertical .Pane.vertical.Pane1 > .uifw-contentlayout-full-size > .SplitPane.horizontal > .Pane.horizontal.Pane1 > .uifw-contentlayout-wrapper > div")),
      expect(elements[0].parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.style).to.include({width: "50%"}),
      expect(elements[0].parentElement?.parentElement?.style).to.include({height: "50%"}),
      expect(elements[1]).to.satisfy(selectorMatches(".SplitPane.vertical .Pane.vertical.Pane1 > .uifw-contentlayout-full-size > .SplitPane.horizontal > .horizontal.Resizer.disabled+.Pane.horizontal.Pane2 > .uifw-contentlayout-wrapper > div")),
      expect(elements[2]).to.satisfy(selectorMatches(".SplitPane.vertical .vertical.Resizer.disabled+.Pane.vertical.Pane2 > .uifw-contentlayout-full-size > .SplitPane.horizontal > .Pane.horizontal.Pane1 > .uifw-contentlayout-wrapper > div")),
      expect(elements[2].parentElement?.parentElement?.style).to.include({height: "50%"}),
      expect(elements[3]).to.satisfy(selectorMatches(".SplitPane.vertical .vertical.Resizer.disabled+.Pane.vertical.Pane2 > .uifw-contentlayout-full-size > .SplitPane.horizontal > .horizontal.Resizer.disabled+.Pane.horizontal.Pane2 > .uifw-contentlayout-wrapper > div")),
    ]);
  });

  const fourQuadrantsHorizontalLayoutDef: ContentLayoutDef = new ContentLayoutDef(
    { // Four Views, two stacked on the left, two stacked on the right.
      id: "fourQuadrantsHorizontal",
      horizontalSplit: {
        id: "fourQuadrantsHorizontal",
        percentage: 0.50,
        lock: true,
        minSizeTop: 100,
        minSizeBottom: 100,
        top: { verticalSplit: { id: "fourQuadrantsTopVertical", percentage: 0.50, left: 0, right: 1, lock: true, minSizeLeft: 100, minSizeRight: 100 } },
        bottom: { verticalSplit: { id: "fourQuadrantsBottomVertical", percentage: 0.50, left: 2, right: 3, lock: true, minSizeLeft: 100, minSizeRight: 100 } },
      },
    },
  );

  it("FourQuadrantsHorizontal renders correctly", () => {
    render(<ContentLayout contentGroup={fourContentGroup} contentLayout={fourQuadrantsHorizontalLayoutDef} isInFooterMode={false} />);

    expect(screen.getAllByText("Test")).to.have.lengthOf(4).and.satisfy((elements: HTMLElement[]) => [
      expect(elements[0]).to.satisfy(selectorMatches(".SplitPane.horizontal .Pane.horizontal.Pane1 > .uifw-contentlayout-full-size > .SplitPane.vertical > .Pane.vertical.Pane1 > .uifw-contentlayout-wrapper > div")),
      expect(elements[0].parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.style).to.include({height: "50%"}),
      expect(elements[0].parentElement?.parentElement?.style).to.include({width: "50%"}),
      expect(elements[1]).to.satisfy(selectorMatches(".SplitPane.horizontal .Pane.horizontal.Pane1 > .uifw-contentlayout-full-size > .SplitPane.vertical > .vertical.Resizer.disabled+.Pane.vertical.Pane2 > .uifw-contentlayout-wrapper > div")),
      expect(elements[2]).to.satisfy(selectorMatches(".SplitPane.horizontal .horizontal.Resizer.disabled+.Pane.horizontal.Pane2 > .uifw-contentlayout-full-size > .SplitPane.vertical > .Pane.vertical.Pane1 > .uifw-contentlayout-wrapper > div")),
      expect(elements[2].parentElement?.parentElement?.style).to.include({width: "50%"}),
      expect(elements[3]).to.satisfy(selectorMatches(".SplitPane.horizontal .horizontal.Resizer.disabled+.Pane.horizontal.Pane2 > .uifw-contentlayout-full-size > .SplitPane.vertical > .vertical.Resizer.disabled+.Pane.vertical.Pane2 > .uifw-contentlayout-wrapper > div")),
    ]);
  });

  it("ContentLayoutDiv mouse down and up", async () => {
    render(<ContentLayout contentGroup={singleContentGroup} contentLayout={singleContentLayout} isInFooterMode={true} />);

    await theUserTo.pointer({target: screen.getByText("Test"), keys: "[MouseLeft>]"});
    expect(ContentViewManager.isMouseDown).to.be.true;
    await theUserTo.pointer("[/MouseLeft]");
    expect(ContentViewManager.isMouseDown).to.be.false;
  });

  it("ContentWrapper mouse down", async () => {
    render(<ContentLayout contentGroup={fourContentGroup} contentLayout={verticalSplitLayout} isInFooterMode={true} />);
    const allTests = screen.getAllByText("Test");
    expect(allTests).to.have.lengthOf(2).and.to.satisfy((elements: HTMLElement[])=> [
      expect(elements[0].parentElement).to.satisfy(childStructure("div+.uifw-contentlayout-overlay-inactive")),
      expect(elements[1].parentElement).to.satisfy(childStructure("div+.uifw-contentlayout-overlay-inactive")),
    ]);

    await theUserTo.click(allTests[1]);

    expect(screen.getAllByText("Test")).to.have.lengthOf(2).and.to.satisfy((elements: HTMLElement[])=> [
      expect(elements[0].parentElement).to.satisfy(childStructure("div+.uifw-contentlayout-overlay-inactive")),
      expect(elements[1].parentElement).to.satisfy(childStructure("div+.uifw-contentlayout-overlay-active")),
    ]);
  });

  it("Vertical SplitPane onChanged", async () => {
    const {container} = render(
      <div>
        <ContentLayout contentGroup={fourContentGroup} contentLayout={verticalSplitLayout} isInFooterMode={true} />
      </div>);

    const rect = sinon.stub(Element.prototype, "getBoundingClientRect");
    rect.onFirstCall().returns(DOMRect.fromRect({height: 100, width: 100, x: 0, y: 0}));
    rect.onSecondCall().returns(DOMRect.fromRect({height: 100, width: 100, x: 0, y: 0}));
    rect.onThirdCall().returns(DOMRect.fromRect({height: 100, width: 100, x: 0, y: 0}));
    rect.returns(DOMRect.fromRect({height: 0, width: 0, x: 0, y: 0}));

    await theUserTo.pointer([
      {keys: "[MouseLeft>]", target: container.querySelector(".Resizer")!, coords: {x: 0, y: 0, clientX: 0, clientY: 0}},
      {coords: {x: 50, y: 50, clientX: 50, clientY: 50}},
      "[/MouseLeft]",
    ]);
    expect(screen.getAllByText("Test")).to.have.lengthOf(2).and.satisfy((elements: HTMLElement[]) => [
      expect(elements[0]).to.satisfy(selectorMatches(".SplitPane.vertical .Pane.vertical.Pane1 > .uifw-contentlayout-wrapper > div")),
      expect(elements[0].parentElement?.parentElement?.style).to.include({width: "94px"}),
    ]);

  });

  it("Horizontal SplitPane onChanged", async () => {
    const {container} = render(
      <div>
        <ContentLayout contentGroup={fourContentGroup} contentLayout={horizontalSplitLayout} isInFooterMode={true} />
      </div>);

    const rect = sinon.stub(Element.prototype, "getBoundingClientRect");
    rect.onFirstCall().returns(DOMRect.fromRect({height: 100, width: 100, x: 0, y: 0}));
    rect.onSecondCall().returns(DOMRect.fromRect({height: 100, width: 100, x: 0, y: 0}));
    rect.onThirdCall().returns(DOMRect.fromRect({height: 100, width: 100, x: 0, y: 0}));
    rect.returns(DOMRect.fromRect({height: 0, width: 0, x: 0, y: 0}));

    await theUserTo.pointer([
      {keys: "[MouseLeft>]", target: container.querySelector(".Resizer")!, coords: {x: 0, y: 0, clientX: 0, clientY: 0}},
      {coords: {x: 50, y: 50, clientX: 50, clientY: 50}},
      "[/MouseLeft]",
    ]);
    expect(screen.getAllByText("Test")).to.have.lengthOf(2).and.satisfy((elements: HTMLElement[]) => [
      expect(elements[0]).to.satisfy(selectorMatches(".SplitPane.horizontal .Pane.horizontal.Pane1 > .uifw-contentlayout-wrapper > div")),
      expect(elements[0].parentElement?.parentElement?.style).to.include({height: "94px"}),
    ]);
  });

  it("ContentLayoutManager.setActiveLayout & refreshActiveLayout should emit onContentLayoutActivatedEvent", async () => {
    const spyMethod = sinon.spy();
    const layoutProps: ContentLayoutProps = {
      id: "UiFramework:tests.singleContent",
      description: "UiFramework:tests.singleContent",
    };
    const contentLayout = new ContentLayoutDef(layoutProps);
    const remove = FrontstageManager.onContentLayoutActivatedEvent.addListener(spyMethod);
    render(<ContentLayout contentGroup={fourContentGroup} contentLayout={contentLayout} />);

    const emptyContentGroup = new ContentGroup({contents: [], id: "empty-cg", layout: contentLayout.toJSON()});

    await ContentLayoutManager.setActiveLayout(contentLayout, emptyContentGroup);
    spyMethod.calledOnce.should.true;

    ContentLayoutManager.refreshActiveLayout();
    spyMethod.calledTwice.should.true;

    remove();
  });

  const threeRightStackedLayoutDef: ContentLayoutDef = new ContentLayoutDef(
    { // Three Views, one on the left, two stacked on the right.
      id: "ThreeRightStacked",
      description: "SampleApp:ContentLayoutDef.ThreeRightStacked",
      verticalSplit: {
        id: "ThreeRightStacked.MainVertical",
        percentage: 0.50,
        left: 0,
        right: { horizontalSplit: { id: "ThreeRightStacked.Right", percentage: 0.50, top: 1, bottom: 3 } },
      },
    },
  );

  it("ContentLayoutDef.getUsedContentIndexes should return correct indexes", () => {
    expect(singleContentLayout.getUsedContentIndexes()).to.have.members([0]);
    expect(verticalSplitLayout.getUsedContentIndexes()).to.have.members([0, 1]);
    expect(horizontalSplitLayout.getUsedContentIndexes()).to.have.members([0, 1]);
    expect(fourQuadrantsVerticalLayout.getUsedContentIndexes()).to.have.members([0, 1, 2, 3]);
    expect(fourQuadrantsHorizontalLayoutDef.getUsedContentIndexes()).to.have.members([0, 1, 2, 3]);
    expect(threeRightStackedLayoutDef.getUsedContentIndexes()).to.have.members([0, 1, 3]);
    expect(fourQuadrantLayout.getUsedContentIndexes()).to.have.members([0, 1, 2, 3]);
  });
});

describe("SingleContentLayout", () => {
  class TestContentControl extends ContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = <div>Test</div>;
    }
  }

  const myContentGroup: ContentGroup = new ContentGroup({
    id: "testGroup",
    layout: StandardContentLayouts.singleView,
    contents: [{ id: "myContent", classId: TestContentControl, applicationData: { name: "Test" } }],
  });

  const myContentLayout: ContentLayoutDef = new ContentLayoutDef({
    id: "SingleContent",
    description: "UiFramework:tests.singleContent",
  });

  class TestFrontstage1 extends FrontstageProvider {
    public static stageId = "TestFrontstage1";
    public get id(): string {
      return TestFrontstage1.stageId;
    }

    public get frontstage(): React.ReactElement<FrontstageProps> { // eslint-disable-line deprecation/deprecation
      return (
        <Frontstage id={this.id} defaultTool={CoreTools.selectElementCommand} // eslint-disable-line deprecation/deprecation
          contentGroup={myContentGroup} />
      );
    }
  }

  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup({ localization: new EmptyLocalization() });
    FrontstageManager.clearFrontstageProviders();

    const frontstageProvider = new TestFrontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(TestFrontstage1.stageId);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  it("Should set active if floating content exists", async () => {
    const floatingNode = <div key="floating" />;
    class TestFloatingContentControl extends FloatingContentControl {
      constructor() {
        super("ContentTestFloatingContentControl", "ContentTestFloatingContentControl", floatingNode);
      }
    }

    const floatingControl = new TestFloatingContentControl();
    ContentViewManager.addFloatingContentControl(floatingControl);

    render(<ContentLayout contentGroup={myContentGroup} contentLayout={myContentLayout} isInFooterMode={true} />);
    expect(screen.getByText("Test").parentElement).to.satisfy(childStructure("div+.uifw-contentlayout-overlay-active"));

    ContentViewManager.setActiveContent(floatingControl.reactNode, true);

    expect(screen.getByText("Test").parentElement).to.satisfy(childStructure("div+.uifw-contentlayout-overlay-inactive"));

    ContentViewManager.dropFloatingContentControl(floatingControl);
  });

});
