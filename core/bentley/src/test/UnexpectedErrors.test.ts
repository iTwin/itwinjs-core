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
    let unexpectedListener1 = 0;
    let unexpectedListener2 = 0;
    let evListener1 = 0; // before bad listener
    let evListener2 = 0; // after bad listener
    const errMsg = "something bad happened";

    UnexpectedErrors.setHandler((e) => {
      expect(e).has.property("message", errMsg);
      unexpectedCalled++;
    });
    UnexpectedErrors.addListener((e) => {
      expect(e).has.property("message", errMsg);
      unexpectedListener1++;
    });
    const drop = UnexpectedErrors.addListener((e) => {
      expect(e).has.property("message", errMsg);
      unexpectedListener2++;
    });
    const myEvent = new BeEvent<() => void>();
    myEvent.addListener(() => evListener1++);
    myEvent.addListener(() => { throw new Error(errMsg); });
    myEvent.addListener(() => evListener2++);

    myEvent.raiseEvent();
    expect(unexpectedCalled).equals(1);
    expect(unexpectedListener1).equals(1);
    expect(unexpectedListener2).equals(1);
    expect(evListener1).equals(1);
    expect(evListener2).equals(1);

    drop(); // drop unexpected error listener2
    myEvent.raiseEvent();
    expect(unexpectedCalled).equals(2);
    expect(unexpectedListener1).equals(2);
    expect(unexpectedListener2).equals(1); // should not be called now
    expect(evListener1).equals(2);
    expect(evListener2).equals(2);

    UnexpectedErrors.setHandler(UnexpectedErrors.reThrowImmediate);
    expect(() => myEvent.raiseEvent()).to.throw(errMsg);
  });
});
