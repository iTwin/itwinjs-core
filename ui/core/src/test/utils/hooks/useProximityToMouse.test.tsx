/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";
import {
  useProximityToMouse,
  calculateProximityScale, calculateToolbarOpacity, calculateBoxShadowOpacity, calculateBackdropFilterBlur,
  getToolbarBackgroundColor, getToolbarBoxShadow, getToolbarBackdropFilter,
  TOOLBAR_OPACITY_DEFAULT, TOOLBAR_BOX_SHADOW_OPACITY_DEFAULT, TOOLBAR_BACKDROP_FILTER_BLUR_DEFAULT,
} from "../../../ui-core/utils/hooks/useProximityToMouse";

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

describe("calculateProximityScale", () => {
  it("should calculate the correct proximity scale", () => {
    let proximityScale = calculateProximityScale(50);
    expect(proximityScale).to.eq(0.50);

    proximityScale = calculateProximityScale(50, 100);
    expect(proximityScale).to.eq(0.50);

    proximityScale = calculateProximityScale(100, 200);
    expect(proximityScale).to.eq(0.50);
  });
});

describe("calculateToolbarOpacity", () => {
  it("should calculate the correct toolbar opacity", () => {
    let toolbarOpacity = calculateToolbarOpacity(1.00);
    expect(toolbarOpacity).to.eq(TOOLBAR_OPACITY_DEFAULT);

    toolbarOpacity = calculateToolbarOpacity(0.50);
    expect(toolbarOpacity).to.eq(TOOLBAR_OPACITY_DEFAULT / 2);
  });
});

describe("calculateBoxShadowOpacity", () => {
  it("should calculate the correct box-shadow opacity", () => {
    let boxShadowOpacity = calculateBoxShadowOpacity(1.00);
    expect(boxShadowOpacity).to.eq(TOOLBAR_BOX_SHADOW_OPACITY_DEFAULT);

    boxShadowOpacity = calculateBoxShadowOpacity(0.50);
    expect(boxShadowOpacity).to.eq(TOOLBAR_BOX_SHADOW_OPACITY_DEFAULT / 2);
  });
});

describe("calculateBackdropFilterBlur", () => {
  it("should calculate the correct backdrop-filter blur", () => {
    let backdropFilterBlur = calculateBackdropFilterBlur(1.00);
    expect(backdropFilterBlur).to.eq(TOOLBAR_BACKDROP_FILTER_BLUR_DEFAULT);

    backdropFilterBlur = calculateBackdropFilterBlur(0.50);
    expect(backdropFilterBlur).to.eq(TOOLBAR_BACKDROP_FILTER_BLUR_DEFAULT / 2);
  });
});

describe("getToolbarBackgroundColor", () => {
  it("should calculate the correct toolbar background-color", () => {
    let backgroundColor = getToolbarBackgroundColor(1.0);
    expect(backgroundColor).to.eq(`rgba(var(--buic-background-2-rgb), 1)`);

    backgroundColor = getToolbarBackgroundColor(0.50);
    expect(backgroundColor).to.eq(`rgba(var(--buic-background-2-rgb), 0.5)`);
  });
});

describe("getToolbarBoxShadow", () => {
  it("should calculate the correct toolbar box-shadow", () => {
    let boxShadow = getToolbarBoxShadow(0.35);
    expect(boxShadow).to.eq(`0 1px 3px 0 rgba(0, 0, 0, 0.35)`);

    boxShadow = getToolbarBoxShadow(0.175);
    expect(boxShadow).to.eq(`0 1px 3px 0 rgba(0, 0, 0, 0.175)`);
  });
});

describe("getToolbarBackdropFilter", () => {
  it("should calculate the correct toolbar backdrop-filter", () => {
    let backdropFilter = getToolbarBackdropFilter(10);
    expect(backdropFilter).to.eq(`blur(10px)`);

    backdropFilter = getToolbarBackdropFilter(5);
    expect(backdropFilter).to.eq(`blur(5px)`);
  });
});
