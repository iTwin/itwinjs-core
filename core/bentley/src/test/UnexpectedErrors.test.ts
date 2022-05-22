/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BeEvent } from "../BeEvent";
import { UnexpectedErrors } from "../UnexpectedErrors";

describe("Unexpected error handling", () => {

  it("from BeEvent", () => {
    let unexpectedCalled = 0;
    let telemetry1 = 0;
    let telemetry2 = 0;
    let evListener1 = 0;
    let evListener2 = 0;
    const error = new Error("something bad happened");

    UnexpectedErrors.setHandler((e) => {
      expect(e).equals(error);
      unexpectedCalled++;
    });
    const drop1 = UnexpectedErrors.addTelemetry((e) => {
      expect(e).equals(error);
      telemetry1++;
    });
    const drop2 = UnexpectedErrors.addTelemetry((e) => {
      expect(e).equals(error);
      telemetry2++;
    });
    const myEvent = new BeEvent<() => void>();
    myEvent.addListener(() => evListener1++); // before bad listener
    myEvent.addListener(() => { throw error; }); // bang
    myEvent.addListener(() => evListener2++); // after bad listener

    myEvent.raiseEvent();
    expect(unexpectedCalled).equals(1);
    expect(telemetry1).equals(1);
    expect(telemetry2).equals(1);
    expect(evListener1).equals(1);
    expect(evListener2).equals(1);

    UnexpectedErrors.handle(error, false);
    expect(unexpectedCalled).equals(2);
    expect(telemetry1).equals(1); // should not be called
    expect(telemetry2).equals(1); // should not be called

    drop2(); // drop telemetry2
    myEvent.raiseEvent();
    expect(unexpectedCalled).equals(3);
    expect(telemetry1).equals(2);
    expect(telemetry2).equals(1); // should not be called now
    expect(evListener1).equals(2);
    expect(evListener2).equals(2);

    drop1(); // drop telemetry1
    myEvent.raiseEvent();
    expect(unexpectedCalled).equals(4);
    expect(telemetry1).equals(2); // now it should not be called either

    const dropBad = UnexpectedErrors.addTelemetry(() => { throw new Error("from telemetry"); });
    myEvent.raiseEvent(); // bad telemetry should not cause errors
    dropBad();

    UnexpectedErrors.setHandler(UnexpectedErrors.reThrowImmediate);
    expect(() => myEvent.raiseEvent()).to.throw(error.message);
  });
});
