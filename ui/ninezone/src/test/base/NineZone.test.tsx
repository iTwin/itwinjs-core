/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { NineZone } from "../../ui-ninezone";
import { NineZoneProvider } from "../Providers";
import { createNineZoneState } from "../../ui-ninezone/base/NineZoneState";
import { MeasureContext } from "../../ui-ninezone/base/NineZone";
import { Rectangle } from "@bentley/ui-core";
import { createDOMRect } from "../Utils";

describe("<NineZone />", () => {
  it("renders correctly", () => {
    const { container } = render(<NineZone
      dispatch={sinon.stub()}
      state={createNineZoneState()}
    >
      9-Zone
    </NineZone>);
    container.firstChild!.should.matchSnapshot();
  });

  it("should measure NineZone bounds", () => {
    // tslint:disable-next-line: variable-name
    const Measurer = React.forwardRef<{ measure: () => Rectangle }>((_, ref) => {
      const measure = React.useContext(MeasureContext);
      React.useImperativeHandle(ref, () => ({
        measure,
      }));
      return <></>;
    });
    const measurerRef = React.createRef<{ measure: () => Rectangle }>();
    const { container } = render(<NineZone
      dispatch={sinon.stub()}
      state={createNineZoneState()}
    >
      <Measurer ref={measurerRef} />
    </NineZone>);
    sinon.stub(container.firstChild! as HTMLElement, "getBoundingClientRect").returns(createDOMRect({
      width: 200,
    }));
    measurerRef.current!.measure().toProps().should.eql({
      left: 0,
      right: 200,
      top: 0,
      bottom: 0,
    });
  });
});

describe("<NineZoneProvider />", () => {
  it("renders correctly", () => {
    const { container } = render(<NineZoneProvider>
      9-Zone
    </NineZoneProvider>);
    container.firstChild!.should.matchSnapshot();
  });
});
