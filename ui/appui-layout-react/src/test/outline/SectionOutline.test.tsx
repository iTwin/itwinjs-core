/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { createNineZoneState, PanelStateContext, TargetOptionsContext } from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";
import { SectionOutline } from "../../appui-layout-react/outline/SectionOutline";

function Wrapper(props: React.PropsWithChildren<{}>) {
  const state = createNineZoneState();
  return (
    <TargetOptionsContext.Provider value={{
      version: "2",
    }}>
      <TestNineZoneProvider state={state}>
        <PanelStateContext.Provider value={state.panels.left}>
          {props.children}
        </PanelStateContext.Provider>
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
});
