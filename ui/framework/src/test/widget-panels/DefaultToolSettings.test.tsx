/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { shallow } from "enzyme";
import * as moq from "typemoq";
import { EditorContainer, PropertyUpdatedArgs } from "@bentley/ui-components";
import { WidgetPanelsDefaultToolSettings } from "../../ui-framework";
import { DialogItemsManager } from "@bentley/ui-abstract";

describe("WidgetPanelsDefaultToolSettings", () => {
  it("should render", () => {
    const manager = moq.Mock.ofType<DialogItemsManager>();
    const row = moq.Mock.ofType<DialogItemsManager["rows"][0]>();
    const item = moq.Mock.ofType<DialogItemsManager["rows"][0]["items"][0]>();
    manager.setup((x) => x.rows).returns(() => [row.object]);
    row.setup((x) => x.items).returns(() => [item.object]);
    const wrapper = shallow(
      <WidgetPanelsDefaultToolSettings
        itemsManager={manager.object}
      />,
    );
    wrapper.should.matchSnapshot();
  });

  it("should handle commit", () => {
    const manager = moq.Mock.ofType<DialogItemsManager>();
    const row = moq.Mock.ofType<DialogItemsManager["rows"][0]>();
    const item = moq.Mock.ofType<DialogItemsManager["rows"][0]["items"][0]>();
    manager.setup((x) => x.rows).returns(() => [row.object]);
    row.setup((x) => x.items).returns(() => [item.object]);
    const wrapper = shallow(
      <WidgetPanelsDefaultToolSettings
        itemsManager={manager.object}
      />,
    );
    (() => wrapper.find(EditorContainer).prop("onCommit")(moq.Mock.ofType<PropertyUpdatedArgs>().object)).should.not.throw();
  });

  it("should handle cancel", () => {
    const manager = moq.Mock.ofType<DialogItemsManager>();
    const row = moq.Mock.ofType<DialogItemsManager["rows"][0]>();
    const item = moq.Mock.ofType<DialogItemsManager["rows"][0]["items"][0]>();
    manager.setup((x) => x.rows).returns(() => [row.object]);
    row.setup((x) => x.items).returns(() => [item.object]);
    const wrapper = shallow(
      <WidgetPanelsDefaultToolSettings
        itemsManager={manager.object}
      />,
    );
    (() => wrapper.find(EditorContainer).prop("onCancel")()).should.not.throw();
  });
});
