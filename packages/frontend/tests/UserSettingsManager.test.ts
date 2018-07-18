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
  const testData = {
    rulesetId: "",
    settingId: "",
    clientId: "",
  };

  beforeEach(() => {
    initializeRpcInterface(ECPresentationRpcInterface);

    interfaceMock = moq.Mock.ofType<ECPresentationRpcInterface>();
    ECPresentationRpcInterface.getClient = () => interfaceMock.object;

    testData.clientId = faker.random.uuid();
    testData.rulesetId = faker.random.uuid();
    testData.settingId = faker.random.word();

    settings = new UserSettingsManager(testData.clientId, testData.rulesetId);
  });

  const requestOptions = () => ({
    rulesetId: testData.rulesetId,
    clientId: testData.clientId,
    settingId: testData.settingId,
  });

  describe("setValue", () => {

    it("calls setUserSettingValue through proxy", async () => {
      interfaceMock
        .setup((x) => x.setUserSettingValue(requestOptions(), { value: "", type: SettingValueTypes.String }))
        .verifiable();

      await settings.setValue(testData.settingId, { value: "", type: SettingValueTypes.String });
      interfaceMock.verifyAll();
    });

  });

  describe("getBoolean", () => {

    it("calls getUserSettingValue through proxy", async () => {
      const value = faker.random.boolean();
      interfaceMock
        .setup((x) => x.getUserSettingValue(requestOptions(), SettingValueTypes.Bool))
        .returns(async () => value)
        .verifiable();

      const result = await settings.getBoolean(testData.settingId);
      expect(result).to.be.equal(value);
      interfaceMock.verifyAll();
    });

  });

  describe("getInt", () => {

    it("calls getUserSettingValue through proxy", async () => {
      const value = faker.random.number();
      interfaceMock
        .setup((x) => x.getUserSettingValue(requestOptions(), SettingValueTypes.Int))
        .returns(async () => value)
        .verifiable();

      const result = await settings.getInt(testData.settingId);
      expect(result).to.be.equal(value);
      interfaceMock.verifyAll();
    });

  });

  describe("getIntArray", () => {

    it("calls getUserSettingValue through proxy", async () => {
      const valuesArray = [faker.random.number(), faker.random.number(), faker.random.number()];
      interfaceMock
        .setup((x) => x.getUserSettingValue(requestOptions(), SettingValueTypes.IntArray))
        .returns(async () => valuesArray)
        .verifiable();

      const result = await settings.getIntArray(testData.settingId);
      expect(result).to.be.deep.equal(valuesArray);
      interfaceMock.verifyAll();
    });

  });

  describe("getId64", () => {

    it("calls getUserSettingValue through proxy", async () => {
      const value = createRandomId();
      interfaceMock
        .setup((x) => x.getUserSettingValue(requestOptions(), SettingValueTypes.Id64))
        .returns(async () => value)
        .verifiable();

      const result = await settings.getId64(testData.settingId);
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
        .setup((x) => x.getUserSettingValue(requestOptions(), SettingValueTypes.Id64Array))
        .returns(async () => valueArray)
        .verifiable();

      const result = await settings.getId64Array(testData.settingId);
      expect(result).to.be.deep.equal(valueArray);
      interfaceMock.verifyAll();
    });

  });

  describe("getString", () => {

    it("calls getUserSettingValue through proxy", async () => {
      const value = faker.random.word();
      interfaceMock
        .setup((x) => x.getUserSettingValue(requestOptions(), SettingValueTypes.String))
        .returns(async () => value)
        .verifiable();

      const result = await settings.getString(testData.settingId);

      expect(result).to.be.equal(value);
      interfaceMock.verifyAll();
    });

  });

});
