/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@helpers/Mocks";
import { createRandomId } from "@helpers/random";
import { ECPresentationRpcInterface, SettingValueTypes } from "@common/index";
import UserSettingsManager from "@src/UserSettingsManager";
import { initializeRpcInterface } from "@helpers/RpcHelper";

describe("UserSettingsManager", () => {

  let interfaceMock: moq.IMock<ECPresentationRpcInterface>;
  let settings: UserSettingsManager;
  const rulesetId = "rulesetId";
  const settingId = "settingId";

  beforeEach(() => {
    initializeRpcInterface(ECPresentationRpcInterface);
    interfaceMock = moq.Mock.ofType<ECPresentationRpcInterface>();
    ECPresentationRpcInterface.getClient = () => interfaceMock.object;
    settings = new UserSettingsManager();
  });

  describe("setValue", () => {

    it("calls setUserSettingValue through proxy", async () => {
      interfaceMock
        .setup((x) => x.setUserSettingValue(rulesetId, settingId, { value: "", type: SettingValueTypes.String }))
        .verifiable();

      await settings.setValue(rulesetId, settingId, { value: "", type: SettingValueTypes.String });
      interfaceMock.verifyAll();
    });

  });

  describe("getBoolean", () => {

    it("calls getUserSettingValue through proxy", async () => {
      const value = faker.random.boolean();
      interfaceMock
        .setup((x) => x.getUserSettingValue(rulesetId, settingId, SettingValueTypes.Bool))
        .returns(async () => value)
        .verifiable();

      const result = await settings.getBoolean(rulesetId, settingId);
      expect(result).to.be.equal(value);
      interfaceMock.verifyAll();
    });

  });

  describe("getInt", () => {

    it("calls getUserSettingValue through proxy", async () => {
      const value = faker.random.number();
      interfaceMock
        .setup((x) => x.getUserSettingValue(rulesetId, settingId, SettingValueTypes.Int))
        .returns(async () => value)
        .verifiable();

      const result = await settings.getInt(rulesetId, settingId);
      expect(result).to.be.equal(value);
      interfaceMock.verifyAll();
    });

  });

  describe("getIntArray", () => {

    it("calls getUserSettingValue through proxy", async () => {
      const valuesArray = [faker.random.number(), faker.random.number(), faker.random.number()];
      interfaceMock
        .setup((x) => x.getUserSettingValue(rulesetId, settingId, SettingValueTypes.IntArray))
        .returns(async () => valuesArray)
        .verifiable();

      const result = await settings.getIntArray(rulesetId, settingId);
      expect(result).to.be.deep.equal(valuesArray);
      interfaceMock.verifyAll();
    });

  });

  describe("getId64", () => {

    it("calls getUserSettingValue through proxy", async () => {
      const value = createRandomId();
      interfaceMock
        .setup((x) => x.getUserSettingValue(rulesetId, settingId, SettingValueTypes.Id64))
        .returns(async () => value)
        .verifiable();

      const result = await settings.getId64(rulesetId, settingId);
      expect(result.equals(value)).to.be.true;
      interfaceMock.verifyAll();
    });

  });

  describe("getId64Array", () => {

    it("calls getUserSettingValue through proxy", async () => {
      const valueArray = [
        createRandomId(),
        createRandomId(),
        createRandomId(),
      ];
      interfaceMock
        .setup((x) => x.getUserSettingValue(rulesetId, settingId, SettingValueTypes.Id64Array))
        .returns(async () => valueArray)
        .verifiable();

      const result = await settings.getId64Array(rulesetId, settingId);
      expect(result).to.be.deep.equal(valueArray);
      interfaceMock.verifyAll();
    });

  });

  describe("getString", () => {

    it("calls getUserSettingValue through proxy", async () => {
      const value = faker.random.word();
      interfaceMock
        .setup((x) => x.getUserSettingValue(rulesetId, settingId, SettingValueTypes.String))
        .returns(async () => value)
        .verifiable();

      const result = await settings.getString(rulesetId, settingId);

      expect(result).to.be.equal(value);
      interfaceMock.verifyAll();
    });

  });

});
