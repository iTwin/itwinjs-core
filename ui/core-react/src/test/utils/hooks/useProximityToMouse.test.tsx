/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import userEvent from "@testing-library/user-event";
import {
  calculateBackdropFilterBlur, calculateBoxShadowOpacity, calculateProximityScale, calculateToolbarOpacity,
  getToolbarBackdropFilter, getToolbarBackgroundColor, getToolbarBoxShadow,
  TOOLBAR_BACKDROP_FILTER_BLUR_DEFAULT, TOOLBAR_BOX_SHADOW_OPACITY_DEFAULT, TOOLBAR_OPACITY_DEFAULT,
  useProximityToMouse, WidgetElementSet,
} from "../../../core-react/utils/hooks/useProximityToMouse";

// eslint-disable-next-line @typescript-eslint/naming-convention
const ProximityToMouse = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  const elementSet = new WidgetElementSet();
  elementSet.add(ref);
  const scale = useProximityToMouse(elementSet, true);

  return (
    <div ref={ref} >
      Scale: {scale}
    </div>
  );
};

describe("useProximityToMouse", () => {

  it("should trigger useEffect handler processing", async () => {
    const theUserTo = userEvent.setup();
    render(<ProximityToMouse />);

    await theUserTo.pointer({coords: {x: 50, y: 50, pageX: 50, pageY: 50}});
    expect(screen.getByText("Scale: 1")).to.exist;

    // Due to this bug https://github.com/testing-library/user-event/issues/1037
    // I "move" the reference element on top of moving the pointer, as pageX/pageY is always 0;
    sinon.replace(Element.prototype, "getBoundingClientRect", () => DOMRect.fromRect({ x: 350, y: 350, height: 50, width: 50 }));

    await theUserTo.pointer({coords: {x: 0, y: 0, pageX: 0, pageY: 0}});
    expect(screen.getByText("Scale: 0")).to.exist;
  });
});

describe("calculateProximityScale", () => {
  it("should calculate the correct proximity scale", () => {
    let proximityScale = calculateProximityScale(50);
    expect(proximityScale).to.eq(0.50);

    proximityScale = calculateProximityScale(50, false, 100);
    expect(proximityScale).to.eq(0.50);

    proximityScale = calculateProximityScale(100, false, 200);
    expect(proximityScale).to.eq(0.50);

    proximityScale = calculateProximityScale(100, false, 60);
    expect(proximityScale).to.eq(0.0);

    proximityScale = calculateProximityScale(50, true, 100);
    expect(proximityScale).to.eq(1.0);

    proximityScale = calculateProximityScale(200, true, 100);
    expect(proximityScale).to.eq(0);
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
