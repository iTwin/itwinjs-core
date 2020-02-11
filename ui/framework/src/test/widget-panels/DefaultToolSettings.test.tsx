/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { shallow } from "enzyme";
import * as moq from "typemoq";
import { EditorContainer, PropertyUpdatedArgs } from "@bentley/ui-components";
import { WidgetPanelsDefaultToolSettings, DefaultToolSettingsProvider } from "../../ui-framework";

describe("WidgetPanelsDefaultToolSettings", () => {
  it("should render", () => {
    const provider = moq.Mock.ofType<DefaultToolSettingsProvider>();
    const row = moq.Mock.ofType<DefaultToolSettingsProvider["rows"][0]>();
    const record = moq.Mock.ofType<DefaultToolSettingsProvider["rows"][0]["records"][0]>();
    provider.setup((x) => x.rows).returns(() => [row.object]);
    row.setup((x) => x.records).returns(() => [record.object]);
    const wrapper = shallow(
      <WidgetPanelsDefaultToolSettings
        dataProvider={provider.object}
      />,
    );
    wrapper.should.matchSnapshot();
  });

  it("should handle commit", () => {
    const provider = moq.Mock.ofType<DefaultToolSettingsProvider>();
    const row = moq.Mock.ofType<DefaultToolSettingsProvider["rows"][0]>();
    const record = moq.Mock.ofType<DefaultToolSettingsProvider["rows"][0]["records"][0]>();
    provider.setup((x) => x.rows).returns(() => [row.object]);
    row.setup((x) => x.records).returns(() => [record.object]);
    const wrapper = shallow(
      <WidgetPanelsDefaultToolSettings
        dataProvider={provider.object}
      />,
    );
    (() => wrapper.find(EditorContainer).prop("onCommit")(moq.Mock.ofType<PropertyUpdatedArgs>().object)).should.not.throw();
  });

  it("should handle cancel", () => {
    const provider = moq.Mock.ofType<DefaultToolSettingsProvider>();
    const row = moq.Mock.ofType<DefaultToolSettingsProvider["rows"][0]>();
    const record = moq.Mock.ofType<DefaultToolSettingsProvider["rows"][0]["records"][0]>();
    provider.setup((x) => x.rows).returns(() => [row.object]);
    row.setup((x) => x.records).returns(() => [record.object]);
    const wrapper = shallow(
      <WidgetPanelsDefaultToolSettings
        dataProvider={provider.object}
      />,
    );
    (() => wrapper.find(EditorContainer).prop("onCancel")()).should.not.throw();
  });
});
