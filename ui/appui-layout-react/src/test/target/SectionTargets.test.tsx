/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { addPanelWidget, createNineZoneState, NineZoneState, PanelStateContext, TargetOptionsContext } from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";
import { SectionTargets } from "../../appui-layout-react/target/SectionTargets";

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

describe("SectionTargets", () => {
  it("should render 1 target per section", () => {
    let state = createNineZoneState();
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    const { container } = render(
      <SectionTargets />,
      {
        wrapper: (props) => <Wrapper state={state} {...props} />, // eslint-disable-line react/display-name
      }
    );
    container.getElementsByClassName("nz-target-widgetTarget").length.should.eq(1);
    container.getElementsByClassName("nz-target-sectionTarget").length.should.eq(0);
  });

  it("should render 3 targets in a single section", () => {
    let state = createNineZoneState();
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <SectionTargets />,
      {
        wrapper: (props) => <Wrapper state={state} {...props} />, // eslint-disable-line react/display-name
      }
    );
    container.getElementsByClassName("nz-target-widgetTarget").length.should.eq(1);
    container.getElementsByClassName("nz-target-sectionTarget").length.should.eq(2);
  });
});
