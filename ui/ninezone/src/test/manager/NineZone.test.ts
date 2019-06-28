/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { NineZoneManager, StagePanelType, Point } from "../../ui-ninezone";
import { NineZoneManagerTestProps } from "./TestProps";
import { ZonesManager, NineZone } from "../../ui-ninezone/zones/manager/Zones";
import { Rectangle } from "../../ui-ninezone/utilities/Rectangle";
import { HorizontalAnchor } from "../../ui-ninezone/widget/Stacked";

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
      const zonesManager = new ZonesManager((p) => new NineZone(p));
      sinon.stub(sut, "getZonesManager").returns(zonesManager);
      const handleTabClickStub = sinon.stub(zonesManager, "handleTabClick").returns(props.zones);
      const newProps = sut.handleWidgetTabClick(6, 11, props);

      handleTabClickStub.calledOnceWithExactly(6, 11, props.zones).should.true;
      newProps.should.eq(props, "props");
    });
  });

  describe("handleWidgetTabDragEnd", () => {
    it("should add widget to new pane if stage panel target is set", () => {
      const sut = new NineZoneManager();
      sut.setPanelTarget({ panelId: "0", panelType: StagePanelType.Right });
      const props = NineZoneManagerTestProps.draggingWidget6;
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
      const props = NineZoneManagerTestProps.draggingWidget9WithWidget6InRightPanel;
      const sut = new NineZoneManager();
      const zonesManager = new ZonesManager((p) => new NineZone(p));
      sinon.stub(sut, "getZonesManager").returns(zonesManager);
      sut.setPaneTarget({ panelId: "0", panelType: StagePanelType.Right, paneIndex: 0 });
      const setWidgetTabIdSpy = sinon.spy(zonesManager, "setWidgetTabId");
      const newProps = sut.handleWidgetTabDragEnd(props);

      setWidgetTabIdSpy.calledOnceWithExactly(6, -1, sinon.match.any as any).should.true;
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
      const props = NineZoneManagerTestProps.draggingWidget4;
      const sut = new NineZoneManager();
      sut.setPanelTarget({ panelId: "0", panelType: StagePanelType.Right });
      const setWidgetHorizontalAnchorSpy = sinon.spy(sut.getZonesManager(), "setWidgetHorizontalAnchor");
      const newProps = sut.handleWidgetTabDragEnd(props);

      setWidgetHorizontalAnchorSpy.calledOnceWithExactly(4, HorizontalAnchor.Right, sinon.match.any as any).should.true;
      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      newProps.zones.widgets.should.not.eq(props.zones.widgets, "zones.widgets");
      newProps.zones.widgets[4].should.not.eq(props.zones.widgets[6], "zones.widgets[4]");
      newProps.zones.widgets[4].horizontalAnchor.should.eq(HorizontalAnchor.Right, "zones.widgets[4].horizontalAnchor");
    });
  });

  describe("handleWidgetTabDragStart", () => {
    it("should add widget to zone and remove from stage panel", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.widget6InRightPanel;
      const newProps = sut.handleWidgetTabDragStart({
        initialPosition: new Point(),
        widgetBounds: new Rectangle(),
        tabId: 5,
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
        tabId: 5,
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

    it("should offset dragging widget that was dragged from left stage panel", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.widget6InLeftPanel;
      const newProps = sut.handleWidgetTabDragStart({
        initialPosition: new Point(),
        widgetBounds: new Rectangle(),
        tabId: 5,
        widgetId: 6,
      }, props);

      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      (!!newProps.zones.draggingWidget).should.true;
      newProps.zones.draggingWidget!.lastPosition.x.should.eq(40, "zones.zones.draggingWidget.lastPosition.x");
      newProps.zones.draggingWidget!.lastPosition.y.should.eq(0, "zones.zones.draggingWidget.lastPosition.y");
    });

    it("should offset dragging widget that was dragged from top stage panel", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.widget6InTopPanel;
      const newProps = sut.handleWidgetTabDragStart({
        initialPosition: new Point(),
        widgetBounds: new Rectangle(),
        tabId: 5,
        widgetId: 6,
      }, props);

      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      (!!newProps.zones.draggingWidget).should.true;
      newProps.zones.draggingWidget!.lastPosition.x.should.eq(0, "zones.zones.draggingWidget.lastPosition.x");
      newProps.zones.draggingWidget!.lastPosition.y.should.eq(80, "zones.zones.draggingWidget.lastPosition.y");
    });

    it("should not update props if zones and nested have not changed", () => {
      const sut = new NineZoneManager();
      const props = NineZoneManagerTestProps.defaultProps;
      const newProps = sut.handleWidgetTabDragStart({
        initialPosition: new Point(),
        widgetBounds: new Rectangle(),
        tabId: 5,
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
        tabId: 5,
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
      const setWidgetTabIdSpy = sinon.spy(sut.getZonesManager(), "setWidgetTabId");
      const newProps = sut.handleWidgetTabDragStart({
        initialPosition: new Point(),
        widgetBounds: new Rectangle(),
        tabId: 5,
        widgetId: 9,
      }, props);

      setWidgetTabIdSpy.calledWithExactly(9, 5, sinon.match.any as any).should.true;
      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "props.zones");
      newProps.zones.widgets.should.not.eq(props.zones.widgets, "props.zones.widgets");
      newProps.zones.widgets[9].should.not.eq(props.zones.widgets[9], "props.zones.widgets[9]");
      newProps.zones.widgets[9].tabIndex.should.eq(5, "props.zones.widgets[9].tabIndex");
    });
  });
});
