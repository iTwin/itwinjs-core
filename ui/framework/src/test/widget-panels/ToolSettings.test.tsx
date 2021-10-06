/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Rectangle } from "@itwin/core-react";
import { createNineZoneState, DragManager, DragManagerContext, NineZoneProvider, ToolSettingsStateContext } from "@itwin/appui-layout-react";
import { render } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react-hooks";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import {
  ConfigurableCreateInfo, FrontstageDef, FrontstageManager, ToolSettingsContent, ToolSettingsDockedContent, ToolSettingsEntry, ToolSettingsGrid,
  ToolUiProvider, useHorizontalToolSettingNodes, useToolSettingsNode, WidgetPanelsToolSettings, ZoneDef,
} from "../../appui-react";

describe("WidgetPanelsToolSettings", () => {
  it("should not render w/o tool settings top center zone", () => {
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => undefined);
    const sut = shallow(<WidgetPanelsToolSettings />);
    sut.should.matchSnapshot();
  });

  it("should render", () => {
    const frontstageDef = new FrontstageDef();
    const topCenter = new ZoneDef();
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    sinon.stub(frontstageDef, "topCenter").get(() => topCenter);
    sinon.stub(topCenter, "isToolSettings").get(() => true);
    const { container } = render(
      <DragManagerContext.Provider value={new DragManager()}>
        <ToolSettingsStateContext.Provider value={{ type: "docked" }}>
          <WidgetPanelsToolSettings />
        </ToolSettingsStateContext.Provider>
      </DragManagerContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});

describe("ToolSettingsDockedContent", () => {
  class ToolUiProviderMock extends ToolUiProvider {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }
  }

  it("should render settings", () => {
    const activeToolSettingsProvider = new ToolUiProviderMock(new ConfigurableCreateInfo("test", "test", "test"), undefined);
    sinon.stub(FrontstageManager, "activeToolSettingsProvider").get(() => activeToolSettingsProvider);
    const horizontalToolSettingNodes: ToolSettingsEntry[] = [{ labelNode: "Date", editorNode: <input type="date" /> }];
    sinon.stub(activeToolSettingsProvider, "horizontalToolSettingNodes").get(() => horizontalToolSettingNodes);
    const { container } = render(
      <DragManagerContext.Provider value={new DragManager()}>
        <ToolSettingsDockedContent />
      </DragManagerContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
    FrontstageManager.onToolSettingsReloadEvent.emit();
  });
});

describe("ToolSettingsGrid", () => {
  it("should render", () => {
    const entries: ToolSettingsEntry[] = [{ labelNode: "Date", editorNode: <input type="date" /> }];

    const sut = shallow(<ToolSettingsGrid settings={entries} />);
    sut.should.matchSnapshot();
  });
});

describe("ToolSettingsContent", () => {
  class ToolUiProviderMock extends ToolUiProvider {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }
  }

  it("should not render if not in 'widget' mode", () => {
    const { container } = render(
      <ToolSettingsStateContext.Provider value={{ type: "docked" }}>
        <ToolSettingsContent />
      </ToolSettingsStateContext.Provider>,
    );
    (container.firstChild === null).should.true;
  });

  it("should render (Floating Widget mode)", () => {
    const activeToolSettingsProvider = new ToolUiProviderMock(new ConfigurableCreateInfo("test", "test", "test"), undefined);
    sinon.stub(FrontstageManager, "activeToolSettingsProvider").get(() => activeToolSettingsProvider);
    sinon.stub(activeToolSettingsProvider, "toolSettingsNode").get(() => <div>Hello World</div>);
    const state = createNineZoneState({
      toolSettings: {
        type: "widget",
      },
    });
    const { container } = render(
      <ToolSettingsStateContext.Provider value={{ type: "widget" }}>
        <NineZoneProvider
          state={state}
          dispatch={sinon.stub()}
          measure={() => new Rectangle()}
        >
          <div className="nz-floating-toolsettings">
            <ToolSettingsContent />
          </div>
        </NineZoneProvider>
      </ToolSettingsStateContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

});

describe("useHorizontalToolSettingNodes", () => {
  it("should add tool activated event listener", () => {
    const addListenerSpy = sinon.spy(FrontstageManager.onToolActivatedEvent, "addListener");
    const removeListenerSpy = sinon.spy(FrontstageManager.onToolActivatedEvent, "removeListener");
    const sut = renderHook(() => useHorizontalToolSettingNodes());
    sut.unmount();
    addListenerSpy.calledOnce.should.true;
    removeListenerSpy.calledOnce.should.true;
  });

  it("should add tool settings reload event listener", () => {
    const addListenerSpy = sinon.spy(FrontstageManager.onToolSettingsReloadEvent, "addListener");
    const removeListenerSpy = sinon.spy(FrontstageManager.onToolSettingsReloadEvent, "removeListener");
    const sut = renderHook(() => useHorizontalToolSettingNodes());
    FrontstageManager.onToolSettingsReloadEvent.emit();
    sut.unmount();
    addListenerSpy.calledOnce.should.true;
    removeListenerSpy.calledOnce.should.true;
  });

  it("should return undefined if activeToolSettingsProvider is unset", () => {
    const { result } = renderHook(() => useHorizontalToolSettingNodes());
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      FrontstageManager.onToolActivatedEvent.emit({ toolId: "t1" });
    });
    (result.current === undefined).should.true;
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

    sinon.stub(FrontstageManager, "activeToolSettingsProvider").get(() => new Tool1UiProvider(new ConfigurableCreateInfo("test", "test", "test"), undefined));
    const sut = renderHook(() => useHorizontalToolSettingNodes());

    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      sinon.stub(FrontstageManager, "activeToolSettingsProvider").get(() => new Tool1UiProvider(new ConfigurableCreateInfo("test", "test", "test"), undefined));
      FrontstageManager.onToolActivatedEvent.emit({
        toolId: "",
      });
      FrontstageManager.onToolSettingsReloadEvent.emit();
    });

    sut.result.current!.should.eq(entries);
  });
});

describe("useToolSettingsNode", () => {
  class ToolUiProviderMock extends ToolUiProvider {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }
  }

  it("should add/remove tool activated event listener", () => {
    const addListenerSpy = sinon.spy(FrontstageManager.onToolActivatedEvent, "addListener");
    const removeListenerSpy = sinon.spy(FrontstageManager.onToolActivatedEvent, "removeListener");
    const sut = renderHook(() => useToolSettingsNode());
    sut.unmount();
    addListenerSpy.calledOnce.should.true;
    removeListenerSpy.calledOnce.should.true;
  });

  it("should add/remove tool settings reload event listener", () => {
    const addListenerSpy = sinon.spy(FrontstageManager.onToolSettingsReloadEvent, "addListener");
    const removeListenerSpy = sinon.spy(FrontstageManager.onToolSettingsReloadEvent, "removeListener");
    const sut = renderHook(() => useToolSettingsNode());
    FrontstageManager.onToolSettingsReloadEvent.emit();
    sut.unmount();
    addListenerSpy.calledOnce.should.true;
    removeListenerSpy.calledOnce.should.true;
  });

  it("should update toolSettingsNode", () => {
    const activeToolSettingsProvider = new ToolUiProviderMock(new ConfigurableCreateInfo("test", "test", "test"), undefined);
    sinon.stub(FrontstageManager, "activeToolSettingsProvider").get(() => activeToolSettingsProvider);
    const sut = renderHook(() => useToolSettingsNode());

    const node = <div>Hello World</div>;
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      sinon.stub(activeToolSettingsProvider, "toolSettingsNode").get(() => node);
      FrontstageManager.onToolActivatedEvent.emit({
        toolId: "",
      });
      FrontstageManager.onToolSettingsReloadEvent.emit();
    });

    sut.result.current!.should.eq(node);
  });

  it("should initialize to undefined w/o active activeToolSettingsProvider", () => {
    sinon.stub(FrontstageManager, "activeToolSettingsProvider").get(() => undefined);
    const { result } = renderHook(() => useToolSettingsNode());

    (result.current === undefined).should.true;
  });

  it("should return undefined if activeToolSettingsProvider is unset", () => {
    const { result } = renderHook(() => useToolSettingsNode());
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      FrontstageManager.onToolActivatedEvent.emit({ toolId: "t1" });
    });
    (result.current === undefined).should.true;
  });
});
