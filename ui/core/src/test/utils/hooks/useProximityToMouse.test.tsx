/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { useProximityToMouse } from "../../../ui-core/utils/hooks/useProximityToMouse";

// tslint:disable-next-line: variable-name
const ProximityToMouse = (props: { children?: (proximity: number) => React.ReactNode }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const proximity = useProximityToMouse(ref);
  return (
    <div ref={ref} >
      {props.children && props.children(proximity)}
    </div>
  );
};

describe("useProximityToMouse", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should add event listeners", () => {
    const spy = sandbox.spy(document, "addEventListener");
    mount(<ProximityToMouse />);

    spy.calledOnceWithExactly("pointermove", sinon.match.any as any).should.true;
  });

  it("should remove event listeners", () => {
    const spy = sandbox.spy(document, "removeEventListener");
    const sut = mount(<ProximityToMouse />);
    sut.unmount();

    spy.calledOnceWithExactly("pointermove", sinon.match.any as any).should.true;
  });

  it("should add event listeners", () => {
    const spy = sandbox.spy(document, "addEventListener");
    const sut = mount(<ProximityToMouse />);

    // trigger useEffect handler processing
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 90 }));

    spy.calledOnceWithExactly("pointermove", sinon.match.any as any).should.true;
    sut.unmount();
  });
});
