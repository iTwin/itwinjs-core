/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { BeDuration } from "@bentley/bentleyjs-core";
import { OutputMessagePriority } from "@bentley/imodeljs-frontend";
import { RelativePosition } from "@bentley/ui-abstract";
import { isReactNotifyMessageDetails, ReactNotifyMessageDetails } from "../../ui-framework.js";
import { isReactMessage } from "@bentley/ui-core";

describe("ReactNotifyMessageDetails", () => {

  it("should support React node & create NotifyMessageDetails", () => {
    const reactNode = (<span>Test</span>);
    const reactMessage = { reactNode };
    const details = new ReactNotifyMessageDetails(OutputMessagePriority.Debug, reactMessage);
    expect(details.messageDetails).to.not.be.undefined;
    expect(isReactMessage(details.briefMessage)).to.be.true;
    expect(isReactNotifyMessageDetails(details)).to.be.true;
  });

  it("should support setPointerTypeDetails", () => {
    const reactNode = (<span>Test</span>);
    const reactMessage = { reactNode };
    const details = new ReactNotifyMessageDetails(OutputMessagePriority.Debug, reactMessage);

    const newSpan = document.createElement("span");
    const point = { x: 10, y: 10 };
    details.setPointerTypeDetails(newSpan, point);
    expect(details.viewport).to.eq(newSpan);
    expect(details.displayPoint !== undefined && details.displayPoint.isExactEqual(point)).to.be.true;
    expect(details.relativePosition).to.eq(RelativePosition.TopRight);
  });

  it("should support setPointerTypeDetails", () => {
    const reactNode = (<span>Test</span>);
    const reactMessage = { reactNode };
    const details = new ReactNotifyMessageDetails(OutputMessagePriority.Debug, reactMessage);

    const newSpan = document.createElement("span");
    details.setInputFieldTypeDetails(newSpan);
    expect(details.inputField).to.eq(newSpan);
  });

  it("should support displayTime", () => {
    const reactNode = (<span>Test</span>);
    const reactMessage = { reactNode };
    const details = new ReactNotifyMessageDetails(OutputMessagePriority.Debug, reactMessage);

    details.displayTime = BeDuration.fromSeconds(5);
    expect(details.displayTime.milliseconds).to.eq(5000);
  });

});
