/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { renderHook, act } from "@testing-library/react-hooks";
import { shallow } from "enzyme";
import { WidgetPanelsToolSettings, useToolSettings, FrontstageManager, FrontstageDef, ZoneDef, ToolSettingsEntry, ToolUiProvider, ConfigurableCreateInfo, ToolSettingsGrid } from "../../ui-framework";

describe("WidgetPanelsToolSettings", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should not render w/o tool settings top center zone", () => {
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => undefined);
    const sut = shallow(<WidgetPanelsToolSettings />);
    sut.should.matchSnapshot();
  });

  it("should render", () => {
    const frontstageDef = new FrontstageDef();
    const topCenter = new ZoneDef();
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    sandbox.stub(frontstageDef, "topCenter").get(() => topCenter);
    sandbox.stub(topCenter, "isToolSettings").get(() => true);
    const sut = shallow(<WidgetPanelsToolSettings />);
    sut.should.matchSnapshot();
  });
});

describe("useToolSettings", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should add tool activated event listener", () => {
    const addListenerSpy = sandbox.spy(FrontstageManager.onToolActivatedEvent, "addListener");
    const removeListenerSpy = sandbox.spy(FrontstageManager.onToolActivatedEvent, "removeListener");
    const sut = renderHook(() => useToolSettings());
    sut.unmount();
    addListenerSpy.calledOnce.should.true;
    removeListenerSpy.calledOnce.should.true;
  });

  it("should update tool settings", () => {
    const node = <></>;
    const entries: ToolSettingsEntry[] = [{ labelNode: "Date", editorNode: <input type="date" /> }];

    class Tool1UiProvider extends ToolUiProvider {
      constructor(info: ConfigurableCreateInfo, options: any) {
        super(info, options);
        this.toolSettingsNode = node;
        this.horizontalToolSettingNodes = this.getHorizontalToolSettings();
      }

      private getHorizontalToolSettings(): ToolSettingsEntry[] | undefined {
        return entries;
      }
    }

    sandbox.stub(FrontstageManager, "activeToolSettingsProvider").get(() => new Tool1UiProvider(new ConfigurableCreateInfo("test", "test", "test"), undefined));
    const sut = renderHook(() => useToolSettings());

    act(() => {
      sandbox.stub(FrontstageManager, "activeToolSettingsProvider").get(() => new Tool1UiProvider(new ConfigurableCreateInfo("test", "test", "test"), undefined));
      FrontstageManager.onToolActivatedEvent.emit({
        toolId: "",
      });
    });

    sut.result.current!.should.eq(entries);
  });

  it("ToolSettingsGrid should render", () => {
    const entries: ToolSettingsEntry[] = [{ labelNode: "Date", editorNode: <input type="date" /> }];

    const sut = shallow(<ToolSettingsGrid settings={entries} />);
    sut.should.matchSnapshot();
  });

});
