/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import {
  useProximityToMouse, useWidgetOpacityContext, WidgetElementSet, WidgetOpacityContext,
} from "../../../core-react";

function WidgetOpacityChild() {
  const isInitialMount = React.useRef(true);
  const ref = React.useRef<HTMLDivElement>(null);
  const { onElementRef } = useWidgetOpacityContext();

  if (isInitialMount.current) {
    isInitialMount.current = false;
    onElementRef(ref);
  }

  return <div ref={ref} />;
}

interface WidgetOpacityParentProps {
  elementSet: WidgetElementSet;
}

function WidgetOpacityParent(props: WidgetOpacityParentProps) {
  const { elementSet } = props;
  const handleChildRef = React.useCallback((elementRef: React.RefObject<Element>) => {
    elementSet.add(elementRef);
  }, [elementSet]);
  const proximityScale = useProximityToMouse(elementSet);

  return (<WidgetOpacityContext.Provider
    value={{
      onElementRef: handleChildRef,
      proximityScale,
    }}
  >
    <div>
      <WidgetOpacityChild />
    </div>
  </WidgetOpacityContext.Provider>
  );
}

describe("useWidgetOpacityContext", () => {

  it("should use the widget opacity context", () => {
    const elementSet = new WidgetElementSet();

    mount(<WidgetOpacityParent elementSet={elementSet} />);

    expect(elementSet.size).to.eq(1);
  });

});
