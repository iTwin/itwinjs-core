/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { Point, Rectangle } from "@itwin/core-react";
import { HorizontalAnchor, NineZoneManager, StagePanelType, ToolSettingsWidgetMode, ZonesManager } from "../../appui-layout-react";
import { NineZoneManagerTestProps } from "./TestProps";

describe("NineZoneManager", () => {
  describe("getNestedPanelsManager", () => {
    it("should return same manager", () => {
      const sut = new NineZoneManager();
      const manager1 = sut.getNestedPanelsManager();
      const manager2 = sut.getNestedPanelsManager();
      manager1.should.eq(manager2);
    });
  });

  describe("getZonesManager", () => {
    it("should return same manager", () => {
      const sut = new NineZoneManager();
      const manager1 = sut.getZonesManager();
      const manager2 = sut.getZonesManager();
      manager1.should.eq(manager2);
    });
  });

  describe("getHiddenWidgets", () => {
    it("should return same hidden widgets", () => {
      const sut = new NineZoneManager();
      const hiddenWidgets1 = sut.getHiddenWidgets();
      const hiddenWidgets2 = sut.getHiddenWidgets();
      hiddenWidgets1.should.eq(hiddenWidgets2);
    });
  });

  describe("handleWidgetTabClick", () => {
    it("should set widget tab id if widget is in a stage panel", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.defaultProps;
      const newProps = sut.handleWidgetTabClick(6, 11, props);

      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      newProps.zones.widgets.should.not.eq(props.zones.widgets, "zones.widgets");
      newProps.zones.widgets[6].should.not.eq(props.zones.widgets[6], "zones.widgets[6]");
      newProps.zones.widgets[6].tabIndex.should.eq(11, "zones.widgets[6].tabIndex");
    });

    it("should close other widgets in same stage panel pane", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.widget6and9InRightPanel;
      const newProps = sut.handleWidgetTabClick(6, 11, props);

      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      newProps.zones.widgets.should.not.eq(props.zones.widgets, "zones.widgets");
      newProps.zones.widgets[9].should.not.eq(props.zones.widgets[9], "zones.widgets[9]");
      newProps.zones.widgets[9].tabIndex.should.eq(-1, "zones.widgets[9].tabIndex");
    });

    it("should not update props if zones have not updated", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.defaultProps;
      const zonesManager = new ZonesManager();
      sinon.stub(sut, "getZonesManager").returns(zonesManager);
      const handleWidgetTabClick = sinon.stub(zonesManager, "handleWidgetTabClick").returns(props.zones);
      const newProps = sut.handleWidgetTabClick(6, 11, props);

      handleWidgetTabClick.calledOnceWithExactly(6, 11, props.zones).should.true;
      newProps.should.eq(props, "props");
    });
  });

  describe("handleWidgetTabDragEnd", () => {
    it("should add widget to new pane if stage panel target is set", () => {
      const sut = new NineZoneManager();
      sut.setPanelTarget({ panelId: "0", panelType: StagePanelType.Right });
      const props = NineZoneManagerTestProps.draggedWidget6;
      const newProps = sut.handleWidgetTabDragEnd(props);

      newProps.should.not.eq(props, "props");
      newProps.nested.should.not.eq(props.nested, "nested");
      newProps.nested.panels.should.not.eq(props.nested.panels, "panels");
      newProps.nested.panels[0].should.not.eq(props.nested.panels[0], "panels[0]");
      newProps.nested.panels[0].right.should.not.eq(props.nested.panels[0].right, "panels[0].right");
      newProps.nested.panels[0].right.panes.should.not.eq(props.nested.panels[0].right.panes, "panels[0].right.panes");
      newProps.nested.panels[0].right.panes.length.should.eq(1, "panels[0].right.panes.length");
      newProps.nested.panels[0].right.panes[0].widgets.length.should.eq(1, "panels[0].right.panes[0].widgets.length");
      newProps.nested.panels[0].right.panes[0].widgets[0].should.eq(6, "panels[0].right.panes[0].widgets[0]");
    });

    it("should close other widgets in pane to which new widget was added", () => {
      const props = NineZoneManagerTestProps.draggedWidget9WithWidget6InRightPanel;
      const sut = new NineZoneManager();
      const zonesManager = new ZonesManager();
      sinon.stub(sut, "getZonesManager").returns(zonesManager);
      sut.setPaneTarget({ panelId: "0", panelType: StagePanelType.Right, paneIndex: 0 });
      const setWidgetTabIndexSpy = sinon.spy(zonesManager, "setWidgetTabIndex");
      const newProps = sut.handleWidgetTabDragEnd(props);

      setWidgetTabIndexSpy.calledOnceWithExactly(6, -1, sinon.match.any).should.true;
      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      newProps.zones.widgets.should.not.eq(props.zones.widgets, "zones.widgets");
      newProps.zones.widgets[6].should.not.eq(props.zones.widgets[6], "zones.widgets[6]");
      newProps.zones.widgets[6].tabIndex.should.not.eq(props.zones.widgets[6].tabIndex, "zones.widgets[6].tabIndex");
    });

    it("should not modify props if zones and nested stage panels have not changed", () => {
      const props = NineZoneManagerTestProps.defaultProps;
      const sut = new NineZoneManager();
      const newProps = sut.handleWidgetTabDragEnd(props);

      newProps.should.eq(props, "props");
    });

    it("should set horizontal anchor if stage panel target is set", () => {
      const props = NineZoneManagerTestProps.draggedWidget4;
      const sut = new NineZoneManager();
      sut.setPanelTarget({ panelId: "0", panelType: StagePanelType.Right });
      const setWidgetHorizontalAnchorSpy = sinon.spy(sut.getZonesManager(), "setWidgetHorizontalAnchor");
      const newProps = sut.handleWidgetTabDragEnd(props);

      setWidgetHorizontalAnchorSpy.calledOnceWithExactly(4, HorizontalAnchor.Right, sinon.match.any).should.true;
      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      newProps.zones.widgets.should.not.eq(props.zones.widgets, "zones.widgets");
      newProps.zones.widgets[4].should.not.eq(props.zones.widgets[6], "zones.widgets[4]");
      newProps.zones.widgets[4].horizontalAnchor.should.eq(HorizontalAnchor.Right, "zones.widgets[4].horizontalAnchor");
    });

    it("should set tool settings widget mode to Tab if dragging widget 2", () => {
      const props = NineZoneManagerTestProps.draggedWidget2;
      const sut = new NineZoneManager();
      sut.setPanelTarget({ panelId: "0", panelType: StagePanelType.Right });
      const setToolSettingsWidgetModeSpy = sinon.spy(sut.getZonesManager(), "setToolSettingsWidgetMode");
      sut.handleWidgetTabDragEnd(props);

      setToolSettingsWidgetModeSpy.calledOnceWithExactly(ToolSettingsWidgetMode.Tab, sinon.match.any).should.true;
    });
  });

  describe("handleWidgetTabDragStart", () => {
    it("should add widget to zone and remove from stage panel", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.widget6InRightPanel;
      const newProps = sut.handleWidgetTabDragStart({
        initialPosition: new Point(),
        widgetBounds: new Rectangle(),
        tabIndex: 5,
        widgetId: 6,
      }, props);

      newProps.should.not.eq(props, "props");
      newProps.nested.should.not.eq(props.nested, "nested");
      newProps.nested.panels.should.not.eq(props.nested.panels, "panels");
      newProps.nested.panels[0].should.not.eq(props.nested.panels[0], "panels[0]");
      newProps.nested.panels[0].right.should.not.eq(props.nested.panels[0].right, "panels[0].right");
      newProps.nested.panels[0].right.panes.should.not.eq(props.nested.panels[0].right.panes, "panels[0].right.panes");
      newProps.nested.panels[0].right.panes.length.should.eq(0, "panels[0].right.panes.length");
      newProps.zones.should.not.eq(props.zones, "zones");
      newProps.zones.zones.should.not.eq(props.zones.zones, "zones.zones");
      newProps.zones.zones[6].should.not.eq(props.zones.zones[6], "zones.zones[6]");
      newProps.zones.zones[6].widgets.should.not.eq(props.zones.zones[6].widgets, "zones.zones[6].widgets");
      newProps.zones.zones[6].widgets.length.should.eq(1, "zones.zones[6].widgets.length");
      newProps.zones.zones[6].widgets[0].should.eq(6, "zones.zones[6].widgets[0]");
    });

    it("should restore previous floating size instead of using stage panel size as floating size", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.widget6InRightPanel;
      const newProps = sut.handleWidgetTabDragStart({
        initialPosition: new Point(),
        widgetBounds: new Rectangle(),
        tabIndex: 5,
        widgetId: 6,
      }, props);

      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      newProps.zones.zones.should.not.eq(props.zones.zones, "zones.zones");
      newProps.zones.zones[6].should.not.eq(props.zones.zones[6], "zones.zones[6]");
      (!!newProps.zones.zones[6].floating).should.true;
      newProps.zones.zones[6].floating!.bounds.left.should.eq(0, "zones.zones[6].floating.bounds.left");
      newProps.zones.zones[6].floating!.bounds.top.should.eq(0, "zones.zones[6].floating.bounds.top");
      newProps.zones.zones[6].floating!.bounds.right.should.eq(40, "zones.zones[6].floating.bounds.right");
      newProps.zones.zones[6].floating!.bounds.bottom.should.eq(80, "zones.zones[6].floating.bounds.bottom");
    });

    it("should offset dragged widget that was dragged from left stage panel", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.widget6InLeftPanel;
      const newProps = sut.handleWidgetTabDragStart({
        initialPosition: new Point(),
        widgetBounds: new Rectangle(),
        tabIndex: 5,
        widgetId: 6,
      }, props);

      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      (!!newProps.zones.draggedWidget).should.true;
      newProps.zones.draggedWidget!.lastPosition.x.should.eq(40, "zones.zones.draggedWidget.lastPosition.x");
      newProps.zones.draggedWidget!.lastPosition.y.should.eq(0, "zones.zones.draggedWidget.lastPosition.y");
    });

    it("should offset dragged widget that was dragged from top stage panel", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.widget6InTopPanel;
      const newProps = sut.handleWidgetTabDragStart({
        initialPosition: new Point(),
        widgetBounds: new Rectangle(),
        tabIndex: 5,
        widgetId: 6,
      }, props);

      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      (!!newProps.zones.draggedWidget).should.true;
      newProps.zones.draggedWidget!.lastPosition.x.should.eq(0, "zones.zones.draggedWidget.lastPosition.x");
      newProps.zones.draggedWidget!.lastPosition.y.should.eq(80, "zones.zones.draggedWidget.lastPosition.y");
    });

    it("should not update props if zones and nested have not changed", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.defaultProps;
      const newProps = sut.handleWidgetTabDragStart({
        initialPosition: new Point(),
        widgetBounds: new Rectangle(),
        tabIndex: 5,
        widgetId: 6,
      }, props);

      newProps.should.eq(props, "props");
    });

    it("should open first tab of first widget if pane is left w/o opened widget", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.widget6and9InRightPanel;
      const newProps = sut.handleWidgetTabDragStart({
        initialPosition: new Point(),
        widgetBounds: new Rectangle(),
        tabIndex: 5,
        widgetId: 6,
      }, props);

      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "props.zones");
      newProps.zones.widgets.should.not.eq(props.zones.widgets, "props.zones.widgets");
      newProps.zones.widgets[9].should.not.eq(props.zones.widgets[9], "props.zones.widgets[9]");
      newProps.zones.widgets[9].tabIndex.should.eq(0, "props.zones.widgets[9].tabIndex");
    });

    it("should open widget tab if dragging closed widget from stage panel", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.widget6and9InRightPanel;
      const setWidgetTabIndexSpy = sinon.spy(sut.getZonesManager(), "setWidgetTabIndex");
      const newProps = sut.handleWidgetTabDragStart({
        initialPosition: new Point(),
        widgetBounds: new Rectangle(),
        tabIndex: 5,
        widgetId: 9,
      }, props);

      setWidgetTabIndexSpy.calledWithExactly(9, 5, sinon.match.any).should.true;
      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "props.zones");
      newProps.zones.widgets.should.not.eq(props.zones.widgets, "props.zones.widgets");
      newProps.zones.widgets[9].should.not.eq(props.zones.widgets[9], "props.zones.widgets[9]");
      newProps.zones.widgets[9].tabIndex.should.eq(5, "props.zones.widgets[9].tabIndex");
    });
  });

  describe("showWidget", () => {
    it("should show widget in zone", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.defaultProps;
      const newProps = sut.showWidget(2, props);

      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      newProps.zones.zones.should.not.eq(props.zones.zones, "zones.zones");
      newProps.zones.zones[2].should.not.eq(props.zones.zones[2], "zones.zones[2]");
      newProps.zones.zones[2].widgets.should.not.eq(props.zones.zones[2].widgets, "zones.zones[2].widgets");
      newProps.zones.zones[2].widgets[0].should.eq(2, "zones.zones[2].widgets[0]");
    });

    it("should show widget in panel", () => {
      const sut = new NineZoneManager();
      const hiddenWidgets = sut.getHiddenWidgets();
      hiddenWidgets[2].panel = {
        key: {
          id: 0,
          type: StagePanelType.Left,
        },
      };
      const props = NineZoneManagerTestProps.defaultProps;
      const newProps = sut.showWidget(2, props);

      newProps.should.not.eq(props, "props");
      newProps.nested.should.not.eq(props.nested, "props.nested");
      newProps.nested.panels.should.not.eq(props.nested.panels, "props.nested.panels");
      newProps.nested.panels[0].should.not.eq(props.nested.panels[0], "props.nested.panels[0]");
      newProps.nested.panels[0].left.should.not.eq(props.nested.panels[0].left, "props.nested.panels[0].left");
      newProps.nested.panels[0].left.panes.should.not.eq(props.nested.panels[0].left.panes, "props.nested.panels[0].left.panes");
      newProps.nested.panels[0].left.panes[0].widgets[0].should.eq(2, "props.nested.panels[0].left.panes[0].widgets[0]");
    });
  });

  describe("hideWidget", () => {
    it("should hide widget in zone", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.visibleWidget2;
      const newProps = sut.hideWidget(2, props);

      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      newProps.zones.zones.should.not.eq(props.zones.zones, "zones.zones");
      newProps.zones.zones[2].should.not.eq(props.zones.zones[2], "zones.zones[2]");
      newProps.zones.zones[2].widgets.should.not.eq(props.zones.zones[2].widgets, "zones.zones[2].widgets");
      newProps.zones.zones[2].widgets.length.should.eq(0, "zones.zones[2].widgets.length");
    });

    it("should hide widget in panel", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.widget2InLeftPanel;
      const newProps = sut.hideWidget(2, props);

      newProps.should.not.eq(props, "props");
      newProps.nested.should.not.eq(props.nested, "nested");
      newProps.nested.panels.should.not.eq(props.nested.panels, "panels");
      newProps.nested.panels[0].should.not.eq(props.nested.panels[0], "panels[0]");
      newProps.nested.panels[0].left.should.not.eq(props.nested.panels[0].left, "panels[0].left");
      newProps.nested.panels[0].left.panes.should.not.eq(props.nested.panels[0].left.panes, "panels[0].left.panes");
      newProps.nested.panels[0].left.panes.length.should.eq(0, "panels[0].left.panes.length");
    });

    it("should not modify props", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.defaultProps;
      const newProps = sut.hideWidget(2, props);
      newProps.should.eq(props, "props");
    });

    it("should open widget in same pane", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.widget2and4InLeftPanelPane;
      const newProps = sut.hideWidget(2, props);
      newProps.should.not.eq(props, "props");
      newProps.zones.widgets[4].tabIndex.should.eq(0, "tabIndex");
    });
  });
});
