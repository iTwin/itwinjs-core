/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import {
  getDefaultNineZoneStagePanelsManagerProps, NineZoneNestedStagePanelsManager, NineZoneStagePanelsManager, StagePanelType,
} from "../../appui-layout-react";

/** @internal */
export const getDefaultProps = () => ({
  panels: {
    0: {
      ...getDefaultNineZoneStagePanelsManagerProps(),
    },
  },
});

describe("NineZoneNestedStagePanelsManager", () => {
  describe("addWidget", () => {
    it("should add widget", () => {
      const props = getDefaultProps();
      const sut = new NineZoneNestedStagePanelsManager();
      const panelsManager = new NineZoneStagePanelsManager();
      const newPanelsProps = getDefaultNineZoneStagePanelsManagerProps();
      sinon.stub(sut, "getPanelsManager").returns(panelsManager);
      sinon.stub(panelsManager, "addWidget").returns(newPanelsProps);
      const newProps = sut.addWidget(1, {
        id: 0,
        type: StagePanelType.Left,
      }, undefined, props);

      newProps.should.not.eq(props);
      newProps.panels[0].should.eq(newPanelsProps);
    });

    it("should not modify props if widget was not added", () => {
      const props = getDefaultProps();
      const sut = new NineZoneNestedStagePanelsManager();
      const panelsManager = new NineZoneStagePanelsManager();
      sinon.stub(sut, "getPanelsManager").returns(panelsManager);
      sinon.stub(panelsManager, "addWidget").returns(props.panels[0]);

      const newProps = sut.addWidget(1, {
        id: 0,
        type: StagePanelType.Left,
      }, undefined, props);

      newProps.should.eq(props);
    });
  });

  describe("removeWidget", () => {
    it("should remove widget", () => {
      const sut = new NineZoneNestedStagePanelsManager();
      const panelsManager = new NineZoneStagePanelsManager();
      const newPanelsProps = getDefaultNineZoneStagePanelsManagerProps();
      sinon.stub(sut, "getPanelsManager").returns(panelsManager);
      sinon.stub(panelsManager, "removeWidget").returns(newPanelsProps);
      const props = getDefaultProps();
      const newProps = sut.removeWidget(1, {
        id: 0,
        type: StagePanelType.Left,
      }, props);

      newProps.should.not.eq(props);
      newProps.panels[0].should.eq(newPanelsProps);
    });

    it("should not modify props if widget was not removed", () => {
      const props = getDefaultProps();
      const sut = new NineZoneNestedStagePanelsManager();
      const panelsManager = new NineZoneStagePanelsManager();
      sinon.stub(sut, "getPanelsManager").returns(panelsManager);
      sinon.stub(panelsManager, "removeWidget").returns(props.panels[0]);

      const newProps = sut.removeWidget(1, {
        id: 0,
        type: StagePanelType.Left,
      }, props);

      newProps.should.eq(props);
    });
  });
});
