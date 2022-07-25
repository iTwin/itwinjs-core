/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { addPanelWidget, createNineZoneState, createPanelsState, createVerticalPanelState, NineZoneState, PanelStateContext } from "../../appui-layout-react";
import { TargetOptionsContext } from "../../appui-layout-react/target/TargetOptions";
import { PanelTargets } from "../../appui-layout-react/target/PanelTargets";
import { TestNineZoneProvider } from "../Providers";

interface WrapperProps {
  state: NineZoneState;
}

function Wrapper({ children, state }: React.PropsWithChildren<WrapperProps>) {
  return (
    <TargetOptionsContext.Provider value={{
      version: "2",
    }}>
      <TestNineZoneProvider state={state}>
        <PanelStateContext.Provider value={state.panels.left}>
          {children}
        </PanelStateContext.Provider>
      </TestNineZoneProvider>
    </TargetOptionsContext.Provider>
  );
}

describe("PanelTargets", () => {
  it("should render a panel target", () => {
    const state = createNineZoneState();
    const { container } = render(
      <PanelTargets />,
      {
        wrapper: (props) => <Wrapper state={state} {...props} />, // eslint-disable-line react/display-name
      }
    );
    container.getElementsByClassName("nz-target-panelTarget").length.should.eq(1);
    container.getElementsByClassName("nz-target-sectionTarget").length.should.eq(0);
  });

  it("should render 3 targets in a single section", () => {
    let state = createNineZoneState({
      panels: createPanelsState({
        left: createVerticalPanelState("left", {
          collapsed: true,
        }),
      }),
    });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <PanelTargets />,
      {
        wrapper: (props) => <Wrapper state={state} {...props} />, // eslint-disable-line react/display-name
      }
    );
    container.getElementsByClassName("nz-target-mergeTarget").length.should.eq(1);
    container.getElementsByClassName("nz-target-sectionTarget").length.should.eq(2);
  });

  it("should render one target in each section (2 sections)", () => {
    let state = createNineZoneState({
      panels: createPanelsState({
        left: createVerticalPanelState("left", {
          collapsed: true,
        }),
      }),
    });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    const { container } = render(
      <PanelTargets />,
      {
        wrapper: (props) => <Wrapper state={state} {...props} />, // eslint-disable-line react/display-name
      }
    );
    container.getElementsByClassName("nz-target-mergeTarget").length.should.eq(2);
    container.getElementsByClassName("nz-target-sectionTarget").length.should.eq(0);
  });

  it("should render no targets if panel is expanded", () => {
    let state = createNineZoneState();
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <PanelTargets />,
      {
        wrapper: (props) => <Wrapper state={state} {...props} />, // eslint-disable-line react/display-name
      }
    );
    container.getElementsByClassName("nz-target-panelTarget").length.should.eq(0);
    container.getElementsByClassName("nz-target-sectionTarget").length.should.eq(0);
  });
});
