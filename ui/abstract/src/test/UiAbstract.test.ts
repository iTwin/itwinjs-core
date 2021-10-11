/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { UiAbstract } from "../appui-abstract/UiAbstract";
import TestUtils from "./TestUtils";
import { DisplayMessageType, MessagePresenter } from "../appui-abstract/notification/MessagePresenter";
import { MessageSeverity } from "../appui-abstract/notification/MessageSeverity";

describe("UiAbstract", () => {

  beforeEach(() => {
    TestUtils.terminateUiAbstract();
  });

  it("i18n should throw Error without initialize", () => {
    expect(() => UiAbstract.localization).to.throw(Error);
  });

  it("terminate should run even if no localization to unregister", () => {
    expect(() => UiAbstract.terminate()).to.not.throw(Error);
  });

  it("i18nNamespace should return UiAbstract", () => {
    expect(UiAbstract.localizationNamespace).to.eq("UiAbstract");
  });

  it("packageName should return appui-abstract", () => {
    expect(UiAbstract.packageName).to.eq("appui-abstract");
  });

  it("translate should return the key (in test environment)", async () => {
    await TestUtils.initializeUiAbstract();
    expect(UiAbstract.translate("test1.test2")).to.eq("test1.test2");
    TestUtils.terminateUiAbstract();
  });

  it("loggerCategory passed null should return 'appui-abstract'", () => {
    expect(UiAbstract.loggerCategory(null)).to.eq("appui-abstract");
  });

  it("calling initialize twice should log", async () => {
    const spyLogger = sinon.spy(Logger, "logInfo");
    expect(UiAbstract.initialized).to.be.false;
    await UiAbstract.initialize(TestUtils.i18n);
    expect(UiAbstract.initialized).to.be.true;
    await UiAbstract.initialize(TestUtils.i18n);
    spyLogger.calledOnce.should.true;
    (Logger.logInfo as any).restore();
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
