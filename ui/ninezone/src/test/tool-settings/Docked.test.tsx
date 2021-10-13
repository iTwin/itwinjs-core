/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import * as ResizeObserverModule from "@itwin/core-react/lib/cjs/core-react/utils/hooks/ResizeObserverPolyfill";
import { act, fireEvent, queryByText, render } from "@testing-library/react";
import {
  DockedToolSetting, DockedToolSettings, eqlOverflown, getOverflown, onOverflowLabelAndEditorResize,
} from "../../appui-layout-react";
import { flushAsyncOperations, ResizeObserverMock } from "../Utils";
import { DragManagerProvider } from "../Providers";

describe("DockedToolSettings", () => {
  it("should render w/o entries", () => {
    const { container } = render(<DockedToolSettings />,
      {
        wrapper: DragManagerProvider,
      },
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render", () => {
    const { container } = render(
      <DockedToolSettings>
        <div>Entry 1</div>
        <>Entry 2</>
        Entry 3
        <span>Entry 4</span>
      </DockedToolSettings>,
      {
        wrapper: DragManagerProvider,
      },
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render overflow button", () => {
    // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
    sinon.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
      if (this.classList.contains("nz-toolSettings-docked")) {
        return DOMRect.fromRect({ width: 100 });
      } else if (queryByText(this, /Entry [0-9]$/)) {
        return DOMRect.fromRect({ width: 50 });
      }
      return new DOMRect();
    });
    const { container } = render(
      <DockedToolSettings>
        <>Entry 1</>
        <>Entry 2</>
        <>Entry 3</>
      </DockedToolSettings>,
      {
        wrapper: DragManagerProvider,
      },
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render overflown entries", () => {
    // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
    sinon.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
      if (this.classList.contains("nz-toolSettings-docked")) {
        return DOMRect.fromRect({ width: 100 });
      } else if (queryByText(this, /Entry [0-9]$/)) {
        return DOMRect.fromRect({ width: 50 });
      }
      return new DOMRect();
    });
    const { container } = render(
      <DockedToolSettings>
        <>Entry 1</>
        <>Entry 2</>
        <>Entry 3</>
      </DockedToolSettings>,
      {
        wrapper: DragManagerProvider,
      },
    );

    act(() => {
      fireEvent.click(document.getElementsByClassName("nz-toolSettings-overflow")[0]);
    });
    container.firstChild!.should.matchSnapshot();
  });

  it("should render panel container", () => {
    // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
    sinon.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
      if (this.classList.contains("nz-toolSettings-docked")) {
        return DOMRect.fromRect({ width: 100 });
      } else if (queryByText(this, /Entry [0-9]$/)) {
        return DOMRect.fromRect({ width: 50 });
      }
      return new DOMRect();
    });
    render(
      <DockedToolSettings
        panelContainer={(props) => <div className="panel-container">{props.children}</div>}
      >
        <DockedToolSetting>Entry 1</DockedToolSetting>
        <DockedToolSetting>Entry 2</DockedToolSetting>
        <DockedToolSetting>Entry 3</DockedToolSetting>
      </DockedToolSettings>,
      {
        wrapper: DragManagerProvider,
      },
    );

    act(() => {
      fireEvent.click(document.getElementsByClassName("nz-toolSettings-overflow")[0]);
    });
    const panel = document.getElementsByClassName("nz-toolSettings-panel")[0];
    panel.should.matchSnapshot();
  });

  it("should close overflow panel on outside click", () => {
    // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
    sinon.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
      if (this.classList.contains("nz-toolSettings-docked")) {
        return DOMRect.fromRect({ width: 100 });
      } else if (queryByText(this, /Entry [0-9]$/)) {
        return DOMRect.fromRect({ width: 50 });
      }
      return new DOMRect();
    });
    render(
      <DockedToolSettings>
        <DockedToolSetting>Entry 1</DockedToolSetting>
        <DockedToolSetting>Entry 2</DockedToolSetting>
        <DockedToolSetting>Entry 3</DockedToolSetting>
      </DockedToolSettings>,
      {
        wrapper: DragManagerProvider,
      },
    );

    act(() => {
      fireEvent.click(document.getElementsByClassName("nz-toolSettings-overflow")[0]);
    });

    document.getElementsByClassName("nz-toolSettings-panel").length.should.eq(1);

    act(() => {
      fireEvent.pointerDown(document);
      fireEvent.pointerUp(document);
    });

    document.getElementsByClassName("nz-toolSettings-panel").length.should.eq(0);
  });

  it("should recalculate overflow on resize", async () => {
    let width = 100;
    // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
    sinon.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
      if (this.classList.contains("nz-toolSettings-docked")) {
        return DOMRect.fromRect({ width });
      } else if (queryByText(this, /Entry [0-9]$/)) {
        return DOMRect.fromRect({ width: 50 });
      }
      return new DOMRect();
    });

    let resizeObserver: ResizeObserverMock | undefined;
    let target: Element | undefined;
    sinon.stub(ResizeObserverModule, "ResizeObserver").callsFake((callback) => new ResizeObserverMock(callback));
    sinon.stub(ResizeObserverMock.prototype, "observe").callsFake(function (this: ResizeObserverMock, element: Element) {
      if (element.classList.contains("nz-toolSettings-docked")) {
        resizeObserver = this;
        target = element;
      }
    });

    const { queryAllByText } = render(
      <DockedToolSettings>
        <DockedToolSetting>Entry 1</DockedToolSetting>
        <DockedToolSetting>Entry 2</DockedToolSetting>
        <DockedToolSetting>Entry 3</DockedToolSetting>
      </DockedToolSettings>,
      {
        wrapper: DragManagerProvider,
      },
    );

    queryAllByText(/Entry [0-9]$/).length.should.eq(2);

    act(() => {
      width = 50;
      resizeObserver!.callback([{
        contentRect: new DOMRect(),
        target: target!,
      } as any], resizeObserver!);
    });

    await flushAsyncOperations();

    queryAllByText(/Entry [0-9]$/).length.should.eq(1);
  });

  it("should recalculate overflow on entry resize", async () => {
    let width = 50;
    // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
    sinon.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
      if (this.classList.contains("nz-toolSettings-docked")) {
        return DOMRect.fromRect({ width: 100 });
      } else if (queryByText(this, /Entry [0-9]$/)) {
        return DOMRect.fromRect({ width });
      }
      return new DOMRect();
    });

    let resizeObserver: ResizeObserverMock | undefined;
    let target: Element | undefined;
    sinon.stub(ResizeObserverModule, "ResizeObserver").callsFake((callback) => new ResizeObserverMock(callback));
    sinon.stub(ResizeObserverMock.prototype, "observe").callsFake(function (this: ResizeObserverMock, element: Element) {
      if (element instanceof HTMLElement && element.classList.contains("nz-toolSettings-setting") && queryByText(element, "Entry 1")) {
        resizeObserver = this;
        target = element;
      }
    });

    const { queryAllByText } = render(
      <DockedToolSettings>
        <DockedToolSetting>Entry 1</DockedToolSetting>
        <DockedToolSetting>Entry 2</DockedToolSetting>
        <DockedToolSetting>Entry 3</DockedToolSetting>
      </DockedToolSettings>,
      {
        wrapper: DragManagerProvider,
      },
    );

    queryAllByText(/Entry [0-9]$/).length.should.eq(2);

    act(() => {
      width = 100;
      resizeObserver!.callback([{
        contentRect: new DOMRect(),
        target: target!,
      } as any], resizeObserver!);
    });

    await flushAsyncOperations();

    queryAllByText(/Entry [0-9]$/).length.should.eq(1);
  });
});

describe("getOverflown", () => {
  it("should overflow additional entries when overflow width is known", () => {
    const overflown = getOverflown(100, [
      ["1", 40],
      ["2", 40],
      ["3", 40],
    ], 50);
    overflown.should.eql(["2", "3"]);
  });

  it("should not overflow active item", () => {
    const overflown = getOverflown(100, [
      ["1", 40],
      ["2", 40],
      ["3", 40],
    ], 50, 1);
    overflown.should.eql(["1", "3"]);
  });
});

describe("onOverflowLabelAndEditorResize", () => {
  it("should not throw", () => {
    (() => onOverflowLabelAndEditorResize()).should.not.throw();
  });
});

describe("eqlOverflown", () => {
  it("should return false if entries are not equal", () => {
    eqlOverflown(["a", "b"], ["a", "c"]).should.false;
  });
});
