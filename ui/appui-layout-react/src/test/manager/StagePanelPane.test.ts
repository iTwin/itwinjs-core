/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { getDefaultNineZoneStagePanelPaneManagerProps, NineZoneStagePanelPaneManager, NineZoneStagePanelPaneManagerProps } from "../../appui-layout-react";

const defaultProps = getDefaultNineZoneStagePanelPaneManagerProps();

describe("NineZoneStagePanelPaneManager", () => {
  describe("addWidget", () => {
    it("should add widget to new pane", () => {
      const sut = new NineZoneStagePanelPaneManager();
      const props = getDefaultNineZoneStagePanelPaneManagerProps();
      const newProps = sut.addWidget(6, props);

      newProps.should.not.eq(props, "props");
      newProps.widgets.should.not.eq(props, "widgets");
      newProps.widgets.length.should.eq(1, "widgets.length");
      newProps.widgets[0].should.eq(6, "widgets[0]");
    });

    it("should not modify props if widget is already added", () => {
      const sut = new NineZoneStagePanelPaneManager();
      const props: NineZoneStagePanelPaneManagerProps = {
        ...defaultProps,
        widgets: [6],
      };
      const newProps = sut.addWidget(6, props);
      newProps.should.eq(props);
    });
  });

  describe("removeWidget", () => {
    it("should remove widget", () => {
      const sut = new NineZoneStagePanelPaneManager();
      const props: NineZoneStagePanelPaneManagerProps = {
        ...defaultProps,
        widgets: [6, 4],
      };
      const newProps = sut.removeWidget(6, props);

      newProps.should.not.eq(props, "props");
      newProps.widgets.should.not.eq(props.widgets, "widgets");
      newProps.widgets.length.should.eq(1, "widgets.length");
      newProps.widgets[0].should.eq(4, "widgets[0]");
    });

    it("should not modify props if widget is not found", () => {
      const sut = new NineZoneStagePanelPaneManager();
      const props: NineZoneStagePanelPaneManagerProps = {
        ...defaultProps,
        widgets: [6, 4],
      };
      const newProps = sut.removeWidget(7, props);
      newProps.should.eq(props);
    });
  });
});
