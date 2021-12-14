/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { UiEvent } from "../../appui-abstract";

describe("UIEvent", () => {

  interface TestEventArgs {
    testId: string;
    testNum: number;
  }

  class TestEvent extends UiEvent<TestEventArgs> { }

  it("should call handler", () => {
    const testEvent: TestEvent = new TestEvent();
    const spyMethod = sinon.spy();

    const testHandler = (args: TestEventArgs) => {
      spyMethod();
      expect(args.testId).to.eq("abc");
      expect(args.testNum).to.eq(999);
    };

    const remove = testEvent.addListener(testHandler);
    testEvent.emit({ testId: "abc", testNum: 999 });
    remove();

    expect(spyMethod.calledOnce).to.be.true;
  });

});
