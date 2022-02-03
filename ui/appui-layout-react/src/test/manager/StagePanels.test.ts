/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import type { NineZoneStagePanelManagerProps, NineZoneStagePanelsManagerProps} from "../../appui-layout-react";
import {
  getDefaultNineZoneStagePanelManagerProps, getDefaultNineZoneStagePanelsManagerProps, NineZoneStagePanelManager,
  NineZoneStagePanelsManager, StagePanelType,
} from "../../appui-layout-react";

describe("NineZoneStagePanelsManager", () => {
  describe("addWidget", () => {
    it("should add widget", () => {
      const sut = new NineZoneStagePanelsManager();
      const panelManager = new NineZoneStagePanelManager();
      const addWidgetProps: NineZoneStagePanelManagerProps = {
        ...getDefaultNineZoneStagePanelManagerProps(),
        panes: [
          {
            widgets: [6],
          },
        ],
      };
      sinon.stub(sut, "getPanelManager").returns(panelManager);
      sinon.stub(panelManager, "addWidget").returns(addWidgetProps);
      const props = getDefaultNineZoneStagePanelsManagerProps();
      const newProps = sut.addWidget(6, StagePanelType.Left, undefined, props);

      newProps.should.not.eq(props);
      newProps.left.should.not.eq(props.left);

      newProps.bottom.should.eq(props.bottom);
      newProps.left.should.eq(addWidgetProps);
      newProps.right.should.eq(props.right);
      newProps.top.should.eq(props.top);
    });

    it("should not modify props if widget is already added", () => {
      const sut = new NineZoneStagePanelsManager();
      const props = getDefaultNineZoneStagePanelsManagerProps();
      const panelManager = new NineZoneStagePanelManager();
      sinon.stub(sut, "getPanelManager").returns(panelManager);
      sinon.stub(panelManager, "addWidget").returns(props.left);
      const newProps = sut.addWidget(6, StagePanelType.Left, undefined, props);

      newProps.should.eq(props);
      newProps.bottom.should.eq(props.bottom);
      newProps.left.should.eq(props.left);
      newProps.right.should.eq(props.right);
      newProps.top.should.eq(props.top);
    });
  });

  describe("removeWidget", () => {
    it("should remove widget", () => {
      const sut = new NineZoneStagePanelsManager();
      const panelManager = new NineZoneStagePanelManager();
      const removeWidgetProps: NineZoneStagePanelManagerProps = {
        ...getDefaultNineZoneStagePanelManagerProps(),
        panes: [
          {
            widgets: [1, 3],
          },
        ],
      };
      sinon.stub(sut, "getPanelManager").returns(panelManager);
      sinon.stub(panelManager, "removeWidget").returns(removeWidgetProps);
      const props: NineZoneStagePanelsManagerProps = {
        ...getDefaultNineZoneStagePanelsManagerProps(),
        left: {
          ...getDefaultNineZoneStagePanelManagerProps(),
          panes: [
            {
              widgets: [1, 2, 3],
            },
          ],
        },
      };
      const newProps = sut.removeWidget(2, StagePanelType.Left, props);

      newProps.should.not.eq(props);
      newProps.left.should.not.eq(props.left);

      newProps.bottom.should.eq(props.bottom);
      newProps.left.should.eq(removeWidgetProps);
      newProps.right.should.eq(props.right);
      newProps.top.should.eq(props.top);
    });

    it("should not modify props if widget is not in panel", () => {
      const sut = new NineZoneStagePanelsManager();
      const props = getDefaultNineZoneStagePanelsManagerProps();
      const panelManager = new NineZoneStagePanelManager();
      sinon.stub(sut, "getPanelManager").returns(panelManager);
      sinon.stub(panelManager, "removeWidget").returns(props.left);
      const newProps = sut.removeWidget(6, StagePanelType.Left, props);

      newProps.should.eq(props);
      newProps.bottom.should.eq(props.bottom);
      newProps.left.should.eq(props.left);
      newProps.right.should.eq(props.right);
      newProps.top.should.eq(props.top);
    });
  });

  describe("getPanelManager", () => {
    it("should not recreate panel manager", () => {
      const sut = new NineZoneStagePanelsManager();
      const panelManager = sut.getPanelManager(StagePanelType.Left);
      const panelManager1 = sut.getPanelManager(StagePanelType.Left);

      panelManager.should.eq(panelManager1);
    });

    it("should return different manager based on panel type", () => {
      const sut = new NineZoneStagePanelsManager();
      const panelManager = sut.getPanelManager(StagePanelType.Left);
      const panelManager1 = sut.getPanelManager(StagePanelType.Right);

      panelManager.should.not.eq(panelManager1);
    });
  });
});
