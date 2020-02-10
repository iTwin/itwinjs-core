/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, fireEvent, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { Panes, usePane, usePanes, paneContextDefaultValue } from "../../ui-ninezone";
import * as PanesModule from "../../ui-ninezone/widget-panels/Panes";

interface PaneProps {
  id?: string;
}

function Pane(props: PaneProps) {
  const pane = usePane();
  return (
    <div
      data-testid={props.id}
    >
      Pane
      <button onClick={pane.onExpand} data-testid={`${props.id}-expand`} />
      <button onClick={pane.onMinimize} data-testid={`${props.id}-minimize`} />
      <button onClick={pane.onRestore} data-testid={`${props.id}-restore`} />
    </div>
  );
}

describe("Panes", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const { container } = render(<Panes />);
    container.firstChild!.should.matchSnapshot();
  });

  it("should render horizontal", () => {
    const { container } = render(<Panes horizontal />);
    container.firstChild!.should.matchSnapshot();
  });

  it("should expand pane", () => {
    const usePanesSpy = sandbox.spy(PanesModule, "usePanes");
    const { getByTestId } = render(<Panes>
      <Pane />
      <Pane id="1" />
    </Panes>);

    const spy = sandbox.spy(usePanesSpy.firstCall.returnValue[1], "expand");
    act(() => {
      const expand = getByTestId("1-expand");
      fireEvent.click(expand);
    });

    spy.calledOnceWithExactly(1).should.true;
  });

  it("should minimize pane", () => {
    const usePanesSpy = sandbox.spy(PanesModule, "usePanes");
    const { getByTestId } = render(<Panes>
      <Pane />
      <Pane id="1" />
    </Panes>);

    const spy = sandbox.spy(usePanesSpy.firstCall.returnValue[1], "minimize");
    act(() => {
      const expand = getByTestId("1-minimize");
      fireEvent.click(expand);
    });

    spy.calledOnceWithExactly(1).should.true;
  });

  it("should restore pane", () => {
    const usePanesSpy = sandbox.spy(PanesModule, "usePanes");
    const { getByTestId } = render(<Panes>
      <Pane />
      <Pane id="1" />
    </Panes>);

    const spy = sandbox.spy(usePanesSpy.firstCall.returnValue[1], "restore");
    act(() => {
      const expand = getByTestId("1-restore");
      fireEvent.click(expand);
    });

    spy.calledOnceWithExactly(1).should.true;
  });
});

describe("paneContextDefaultValue", () => {
  it("default handlers should not throw", () => {
    (() => {
      paneContextDefaultValue.onExpand();
      paneContextDefaultValue.onMinimize();
      paneContextDefaultValue.onRestore();
    }).should.not.throw();
  });
});

describe("usePanes", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should not minimize last pane", () => {
    const paneNodes: React.ReactElement<{ children: React.ReactNode }> = <>
      <div />
      <div />
    </>;
    const { result } = renderHook(() => usePanes(paneNodes.props.children));
    act(() => result.current[1].minimize(0));

    const panes = result.current[0];
    act(() => result.current[1].minimize(1));
    panes.should.eq(result.current[0]);
  });
});
