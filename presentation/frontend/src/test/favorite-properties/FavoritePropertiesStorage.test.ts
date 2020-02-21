/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { configureForPromiseResult } from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { SettingsStatus, SettingsAdmin } from "@bentley/imodeljs-clients";
import { AuthorizedFrontendRequestContext, IModelApp } from "@bentley/imodeljs-frontend";
import { IModelAppFavoritePropertiesStorage } from "../../presentation-frontend/favorite-properties/FavoritePropertiesStorage";
import { PropertyFullName, FavoritePropertiesOrderInfo } from "../../presentation-frontend/favorite-properties/FavoritePropertiesManager";

describe("IModelAppFavoritePropertiesStorage", () => {

  let storage: IModelAppFavoritePropertiesStorage;
  let settingsAdminMock: moq.IMock<SettingsAdmin>;

  beforeEach(async () => {
    const requestConextMock = moq.Mock.ofType<AuthorizedFrontendRequestContext>();
    configureForPromiseResult(requestConextMock);
    sinon.stub(AuthorizedFrontendRequestContext, "create").resolves(requestConextMock.object);
    sinon.stub(IModelApp, "settings").get(() => settingsAdminMock.object);

    storage = new IModelAppFavoritePropertiesStorage();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("loadProperties", () => {

    it("returns favorite properties", async () => {
      settingsAdminMock = moq.Mock.ofType<SettingsAdmin>();
      settingsAdminMock.setup((x) => x.getUserSetting(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.Success,
        setting: [],
      }));

      const properties = await storage.loadProperties();
      expect(properties).to.be.not.undefined;
      expect(properties!.size).to.eq(0);
    });

    it("is backwards compatible", async () => {
      settingsAdminMock = moq.Mock.ofType<SettingsAdmin>();
      settingsAdminMock.setup((x) => x.getUserSetting(moq.It.isAny(), "imodeljs.presentation", moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.Success,
        setting: undefined,
      }));
      settingsAdminMock.setup((x) => x.getUserSetting(moq.It.isAny(), "Properties", moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.Success,
        setting: {
          nestedContentInfos: new Set<string>(["nestedContentInfo"]),
          propertyInfos: new Set<string>(["propertyInfo"]),
          baseFieldInfos: new Set<string>(["baseFieldInfo"]),
        },
      }));

      const properties = await storage.loadProperties();
      expect(properties).to.be.not.undefined;
      expect(properties!.size).to.eq(3);
    });

    it("returns undefined", async () => {
      settingsAdminMock.setup((x) => x.getUserSetting(moq.It.isAny(), "imodeljs.presentation", moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.UnknownError,
        setting: undefined,
      }));
      settingsAdminMock.setup((x) => x.getUserSetting(moq.It.isAny(), "Properties", moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.UnknownError,
        setting: undefined,
      }));

      const properties = await storage.loadProperties();
      expect(properties).to.be.undefined;
    });

  });

  describe("saveProperties", () => {

    it("saves favorite properties", async () => {
      settingsAdminMock.setup((x) => x.saveUserSetting(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.Success,
      }));

      const properties = new Set<PropertyFullName>(["propertyInfo1", "propertyInfo2"]);
      await storage.saveProperties(properties);
      settingsAdminMock.verify(async (x) => x.saveUserSetting(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), undefined, undefined), moq.Times.once());
    });

  });

  describe("loadPropertiesOrder", () => {

    it("returns properties order", async () => {
      const orderInfo: FavoritePropertiesOrderInfo = {
        parentClassName: undefined,
        name: "orderInfoName",
        priority: 5,
        orderedTimestamp: new Date(),
      };
      settingsAdminMock = moq.Mock.ofType<SettingsAdmin>();
      settingsAdminMock.setup((x) => x.getUserSetting(moq.It.isAny(), "imodeljs.presentation", "FavoritePropertiesOrderInfo", moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.Success,
        setting: [orderInfo],
      }));

      const properties = await storage.loadPropertiesOrder("projectId", "imodelId");
      expect(properties).to.be.not.undefined;
      expect(properties!.length).to.eq(1);
      expect(properties![0]).to.eq(orderInfo);
    });

    it("returns undefined", async () => {
      settingsAdminMock.setup((x) => x.getUserSetting(moq.It.isAny(), "imodeljs.presentation", "FavoritePropertiesOrderInfo", moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.UnknownError,
        setting: undefined,
      }));
      sinon.stub(IModelApp, "settings").get(() => settingsAdminMock.object);

      const properties = await storage.loadPropertiesOrder("projectId", "imodelId");
      expect(properties).to.be.undefined;
    });

  });

  describe("savePropertiesOrder", () => {

    it("saves properties order", async () => {
      settingsAdminMock.setup((x) => x.saveUserSetting(moq.It.isAny(), moq.It.isAny(), "imodeljs.presentation", "FavoritePropertiesOrderInfo", moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.Success,
      }));

      const orderInfo: FavoritePropertiesOrderInfo = {
        parentClassName: undefined,
        name: "orderInfoName",
        priority: 5,
        orderedTimestamp: new Date(),
      };

      await storage.savePropertiesOrder([orderInfo], "projectId", "imodelId");
      settingsAdminMock.verify(async (x) => x.saveUserSetting(moq.It.isAny(), moq.It.isAny(), "imodeljs.presentation", "FavoritePropertiesOrderInfo", moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.once());
    });

  });

});
