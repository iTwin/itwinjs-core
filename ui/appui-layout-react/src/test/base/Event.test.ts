/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { EventEmitter } from "../../appui-layout-react";

describe("EventEmitter", () => {
  it("should remove event when emitting", () => {
    const sut = new EventEmitter();
    const e1 = () => { sut.remove(e2); };
    const e2 = sinon.stub();
    sut.add(e1);
    sut.add(e2);
    sut.emit();

    e2.notCalled.should.true;
  });
});
