/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { act, render } from "@testing-library/react";
import { addTab, createNineZoneState, createPanelsState, createVerticalPanelState, DragManager, NineZoneState, PanelSideContext, PanelStateContext } from "../../appui-layout-react";
import { TargetOptionsContext } from "../../appui-layout-react/target/TargetOptions";
import { createDragInfo, TestNineZoneProvider } from "../Providers";
import { SectionOutline } from "../../appui-layout-react/outline/SectionOutline";
import { expect } from "chai";

interface WrapperProps {
  state?: NineZoneState;
  dragManagerRef?: React.Ref<DragManager>;
}

function Wrapper({
  children,
  dragManagerRef,
  state = createNineZoneState(),
}: React.PropsWithChildren<WrapperProps>) {
  const side = "left" as const;
  return (
    <TargetOptionsContext.Provider value={{
      version: "2",
    }}>
      <TestNineZoneProvider
        state={state}
        dragManagerRef={dragManagerRef}
      >
        <PanelSideContext.Provider value={side}>
          <PanelStateContext.Provider value={state.panels[side]}>
            {children}
          </PanelStateContext.Provider>
        </PanelSideContext.Provider>
      </TestNineZoneProvider>
    </TargetOptionsContext.Provider>
  );
}

const wrapper = Wrapper;

describe("SectionOutline", () => {
  it("should render", () => {
    const { container } = render(
      <SectionOutline sectionIndex={0} />,
      {
        wrapper,
      }
    );
    container.getElementsByClassName("nz-outline-sectionOutline").length.should.eq(1);
  });

  it("should render visible", () => {
    const dragManager = React.createRef<DragManager>();
    let state = createNineZoneState({
      panels: createPanelsState({
        left: createVerticalPanelState("left", { size: 200, splitterPercent: 40 }),
      }),
    });
    state = addTab(state, "t1");
    const { container } = render(
      <SectionOutline sectionIndex={0} />,
      {
        wrapper: (props) => <Wrapper state={state} dragManagerRef={dragManager} {...props} />, // eslint-disable-line react/display-name
      }
    );

    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragInfo(),
        item: {
          type: "tab",
          id: "t1",
        },
      });
      dragManager.current!.handleTargetChanged({
        type: "section",
        sectionIndex: 0,
        newWidgetId: "nw1",
        side: "left",
      });
    });

    const element = container.getElementsByClassName("nz-outline-sectionOutline")[0];
    expect(element).to.not.be.undefined;

    (element as HTMLElement).style.height.should.eq("40%");
  });
});
