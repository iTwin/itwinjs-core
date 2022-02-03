/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import type { NineZoneStagePanelManagerProps} from "../../appui-layout-react";
import {
  getDefaultNineZoneStagePanelManagerProps, HorizontalAnchor, NineZoneStagePanelManager,
  NineZoneStagePanelPaneManager, StagePanelType, VerticalAnchor,
} from "../../appui-layout-react";

describe("NineZoneStagePanelManager", () => {
  describe("getHorizontalAnchor", () => {
    it("should return horizontal anchor for left stage panel", () => {
      const anchor = NineZoneStagePanelManager.getHorizontalAnchor(StagePanelType.Left);
      anchor.should.eq(HorizontalAnchor.Left);
    });

    it("should return horizontal anchor for top stage panel", () => {
      const anchor = NineZoneStagePanelManager.getHorizontalAnchor(StagePanelType.Top);
      anchor.should.eq(HorizontalAnchor.Right);
    });

    it("should return horizontal anchor for right stage panel", () => {
      const anchor = NineZoneStagePanelManager.getHorizontalAnchor(StagePanelType.Right);
      anchor.should.eq(HorizontalAnchor.Right);
    });

    it("should return horizontal anchor for bottom stage panel", () => {
      const anchor = NineZoneStagePanelManager.getHorizontalAnchor(StagePanelType.Bottom);
      anchor.should.eq(HorizontalAnchor.Right);
    });
  });

  describe("getVerticalAnchor", () => {
    it("should return horizontal anchor for left stage panel", () => {
      const anchor = NineZoneStagePanelManager.getVerticalAnchor(StagePanelType.Left);
      anchor.should.eq(VerticalAnchor.Middle);
    });

    it("should return horizontal anchor for top stage panel", () => {
      const anchor = NineZoneStagePanelManager.getVerticalAnchor(StagePanelType.Top);
      anchor.should.eq(VerticalAnchor.TopPanel);
    });

    it("should return horizontal anchor for right stage panel", () => {
      const anchor = NineZoneStagePanelManager.getVerticalAnchor(StagePanelType.Right);
      anchor.should.eq(VerticalAnchor.Middle);
    });

    it("should return horizontal anchor for bottom stage panel", () => {
      const anchor = NineZoneStagePanelManager.getVerticalAnchor(StagePanelType.Bottom);
      anchor.should.eq(VerticalAnchor.BottomPanel);
    });
  });

  describe("addWidget", () => {
    it("should add widget to new pane", () => {
      const sut = new NineZoneStagePanelManager();
      const props = getDefaultNineZoneStagePanelManagerProps();
      const newProps = sut.addWidget(6, undefined, props);

      newProps.should.not.eq(props, "props");
      newProps.panes.should.not.eq(props.panes, "panes");
      newProps.panes.length.should.eq(1, "panes.length");
      newProps.panes[0].widgets.length.should.eq(1, "panes[0].widgets.length");
      newProps.panes[0].widgets[0].should.eq(6, "panes[0].widgets[0]");
    });

    it("should not modify props if widget is already added", () => {
      const sut = new NineZoneStagePanelManager();
      sinon.stub(sut, "findWidget").returns({ paneIndex: 0, widgetIndex: 0 });
      const props = getDefaultNineZoneStagePanelManagerProps();
      const newProps = sut.addWidget(6, undefined, props);

      newProps.should.eq(props);
    });

    it("should not modify props if paneIndex is greater that panes count", () => {
      const sut = new NineZoneStagePanelManager();
      const props = getDefaultNineZoneStagePanelManagerProps();
      const newProps = sut.addWidget(6, 1, props);

      newProps.should.eq(props);
    });
  });

  describe("removeWidget", () => {
    it("should remove widget", () => {
      const sut = new NineZoneStagePanelManager();
      const props: NineZoneStagePanelManagerProps = {
        ...getDefaultNineZoneStagePanelManagerProps(),
        panes: [
          {
            widgets: [6, 4],
          },
        ],
      };
      const newProps = sut.removeWidget(6, props);

      newProps.should.not.eq(props, "props");
      newProps.panes.should.not.eq(props.panes, "panes");
      newProps.panes.length.should.eq(1, "panes.length");
      newProps.panes[0].should.not.eq(props.panes[0], "panes[0]");
      newProps.panes[0].widgets.should.not.eq(props.panes[0].widgets, "panes[0].widgets");
      newProps.panes[0].widgets.length.should.eq(1, "panes[0].widgets.length");
      newProps.panes[0].widgets[0].should.eq(4, "panes[0].widgets[0]");
    });

    it("should remove pane if all widgets are removed", () => {
      const sut = new NineZoneStagePanelManager();
      const props: NineZoneStagePanelManagerProps = {
        ...getDefaultNineZoneStagePanelManagerProps(),
        panes: [
          {
            widgets: [6],
          },
        ],
      };
      const newProps = sut.removeWidget(6, props);

      newProps.should.not.eq(props, "props");
      newProps.panes.should.not.eq(props.panes, "panes");
      newProps.panes.length.should.eq(0, "panes.length");
    });

    it("should not modify props if widget is not found", () => {
      const sut = new NineZoneStagePanelManager();
      sinon.stub(sut, "findWidget").returns(undefined);
      const props = getDefaultNineZoneStagePanelManagerProps();
      const newProps = sut.removeWidget(7, props);
      newProps.should.eq(props);
    });

    it("should not modify props if widget is not removed from pane", () => {
      const props: NineZoneStagePanelManagerProps = {
        ...getDefaultNineZoneStagePanelManagerProps(),
        panes: [
          {
            widgets: [6],
          },
        ],
      };
      const sut = new NineZoneStagePanelManager();
      const paneManager = new NineZoneStagePanelPaneManager();
      sinon.stub(sut, "getPaneManager").returns(paneManager);
      sinon.stub(paneManager, "removeWidget").returns(props.panes[0]);
      const newProps = sut.removeWidget(6, props);
      newProps.should.eq(props);
    });
  });

  describe("findWidget", () => {
    it("should find widget", () => {
      const sut = new NineZoneStagePanelManager();
      const props: NineZoneStagePanelManagerProps = {
        ...getDefaultNineZoneStagePanelManagerProps(),
        panes: [
          {
            widgets: [6, 4],
          },
          {
            widgets: [1, 2, 7],
          },
        ],
      };
      const widget = sut.findWidget(7, props);

      (!!widget).should.true;
      widget!.paneIndex.should.eq(1);
      widget!.widgetIndex.should.eq(2);
    });
  });

  describe("getPaneManager", () => {
    it("should return same pane manager", () => {
      const sut = new NineZoneStagePanelManager();
      const manager1 = sut.getPaneManager(0);
      const manager2 = sut.getPaneManager(0);

      (!!manager1).should.true;
      manager1.should.eq(manager2);
    });
  });
});
