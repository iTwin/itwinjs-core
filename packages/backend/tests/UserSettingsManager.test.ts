/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import { createRandomId } from "@helpers/random";
import * as faker from "faker";
import { SettingValueTypes, ECPresentationError } from "@common/index";
import { NativePlatformDefinition } from "@src/NativePlatform";
import UserSettingsManager from "@src/UserSettingsManager";

describe("UserSettingsManager", () => {

  let settingsManager: UserSettingsManager;
  const rulesetId = "rulesetId";
  const settingId = "settingId";
  const addonMock = moq.Mock.ofType<NativePlatformDefinition>();
  beforeEach(() => {
    addonMock.reset();
    settingsManager = new UserSettingsManager(() => addonMock.object);
  });

  describe("setValue", () => {

    it("calls addon's setUserSettingValue", async () => {
      addonMock
        .setup((x) => x.setUserSetting(rulesetId, settingId, JSON.stringify({ value: "value", type: SettingValueTypes.String })))
        .verifiable();

      await settingsManager.setValue(rulesetId, settingId, { value: "value", type: SettingValueTypes.String });
      addonMock.verifyAll();
    });

  });

  describe("getBoolean", () => {

    it("gets boolean setting value", async () => {
      const value = faker.random.boolean();
      addonMock
        .setup((x) => x.getUserSetting(rulesetId, settingId, SettingValueTypes.Bool))
        .returns(() => value)
        .verifiable();

      const result = await settingsManager.getValue(rulesetId, settingId, SettingValueTypes.Bool);
      expect(result).to.be.equal(value);
      addonMock.verifyAll();
    });

  });

  describe("getInt", () => {

    it("gets integer setting value", async () => {
      const value = faker.random.number();
      addonMock
        .setup((x) => x.getUserSetting(rulesetId, settingId, SettingValueTypes.Int))
        .returns(() => (value))
        .verifiable();

      const result = await settingsManager.getValue(rulesetId, settingId, SettingValueTypes.Int);
      expect(result).to.be.equal(value);
      addonMock.verifyAll();
    });

  });

  describe("getIntArray", () => {

    it("gets integer array setting value", async () => {
      const valueArray = [faker.random.number(), faker.random.number(), faker.random.number()];
      addonMock
        .setup((x) => x.getUserSetting(rulesetId, settingId, SettingValueTypes.IntArray))
        .returns(() => valueArray)
        .verifiable();

      const result = await settingsManager.getValue(rulesetId, settingId, SettingValueTypes.IntArray);
      expect(result).to.deep.eq(valueArray);
      addonMock.verifyAll();
    });

  });

  describe("getId64", () => {

    it("gets Id64 setting value", async () => {
      const value = createRandomId();
      addonMock
        .setup((x) => x.getUserSetting(rulesetId, settingId, SettingValueTypes.Id64))
        .returns(() => value.value)
        .verifiable();

      const result = await settingsManager.getValue(rulesetId, settingId, SettingValueTypes.Id64);
      expect(result).to.be.deep.equal(value);
      addonMock.verifyAll();
    });

  });

  describe("getId64Array", () => {

    it("gets Id64 array setting value", async () => {
      const valueArray = [
        createRandomId(),
        createRandomId(),
        createRandomId(),
      ];
      addonMock
        .setup((x) => x.getUserSetting(rulesetId, settingId, SettingValueTypes.Id64Array))
        .returns(() => valueArray)
        .verifiable();

      const result = await settingsManager.getValue(rulesetId, settingId, SettingValueTypes.Id64Array);
      expect(result).to.be.deep.equal(valueArray);
      addonMock.verifyAll();
    });

  });

  describe("getString", () => {

    it("gets string setting value", async () => {
      const value = faker.random.word();
      addonMock
        .setup((x) => x.getUserSetting(rulesetId, settingId, SettingValueTypes.String))
        .returns(() => value)
        .verifiable();

      const result = await settingsManager.getValue(rulesetId, settingId, SettingValueTypes.String);
      expect(result).to.be.equal(value);
      addonMock.verifyAll();
    });

    describe("getValue", () => {

      it("throws if setting type is invalid", () => {
        expect(settingsManager.getValue.apply(settingsManager, [rulesetId, settingId, ""])).rejectedWith(ECPresentationError);
      });

    });

  });

});
