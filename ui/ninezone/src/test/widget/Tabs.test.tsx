/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { WidgetTabs, useWidgetTab } from "../../ui-ninezone";
import { createDOMRect } from "../Utils";
import { PaneContextProvider } from "../Providers";

function Tab(props: {
  width: number,
}) {
  const latestProps = React.useRef(props);
  const tab = useWidgetTab();
  const handleRef = React.useCallback(() => {
    tab.onResize && tab.onResize(latestProps.current.width);
  }, [tab]);
  return <div ref={handleRef}></div>;
}

describe("WidgetTabs", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const { container } = render(
      <WidgetTabs>
        <>a</>
        b
        <>c</>
      </WidgetTabs>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render overflow panel", () => {
    sandbox.stub(Element.prototype, "getBoundingClientRect").returns(createDOMRect({ width: 100 }));
    const { container } = render(
      <WidgetTabs>
        <Tab width={50} />
        <Tab width={50} />
        <Tab width={50} />
      </WidgetTabs>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should overflow all tabs in minimized horizontal pane", () => {
    sandbox.stub(Element.prototype, "getBoundingClientRect").returns(createDOMRect({ width: 100 }));
    const { container } = render(
      <PaneContextProvider
        horizontal
        minimized
      >
        <WidgetTabs>
          <Tab width={50} />
          <Tab width={50} />
          <Tab width={50} />
        </WidgetTabs>
      </PaneContextProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
