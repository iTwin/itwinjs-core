/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { UiAbstract } from "../appui-abstract/UiAbstract";
import { DisplayMessageType, MessagePresenter } from "../appui-abstract/notification/MessagePresenter";
import { MessageSeverity } from "../appui-abstract/notification/MessageSeverity";

describe("UiAbstract", () => {

  it("loggerCategory passed null should return 'appui-abstract'", () => {
    expect(UiAbstract.loggerCategory(null)).to.eq("appui-abstract");
  });

  it("messagePresenter should throw Error without being set", () => {
    expect(() => UiAbstract.messagePresenter).to.throw(Error);
  });

  it("messagePresenter should return set object", () => {
    const mp: MessagePresenter = {
      displayMessage: (_severity: MessageSeverity, _briefMessage: HTMLElement | string, _detailedMessage?: HTMLElement | string, _messageType?: DisplayMessageType.Toast): void => { },
      displayInputFieldMessage: (_inputField: HTMLElement, _severity: MessageSeverity, _briefMessage: HTMLElement | string, _detailedMessage?: HTMLElement | string): void => { },
      closeInputFieldMessage: (): void => { },
    };
    UiAbstract.messagePresenter = mp;
    expect(UiAbstract.messagePresenter).to.eq(mp);
  });

});
