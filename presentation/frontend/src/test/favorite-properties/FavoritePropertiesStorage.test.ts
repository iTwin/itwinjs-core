/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { configureForPromiseResult } from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { SettingsStatus, SettingsAdmin } from "@bentley/imodeljs-clients";
import { AuthorizedFrontendRequestContext, IModelApp } from "@bentley/imodeljs-frontend";
import { IModelAppFavoritePropertiesStorage } from "../../favorite-properties/FavoritePropertiesStorage";
import { FavoriteProperties } from "../../favorite-properties/FavoritePropertiesManager";

describe("IModelAppFavoritePropertiesStorage", () => {

  let storage: IModelAppFavoritePropertiesStorage;
  let settingsAdminMock: moq.IMock<SettingsAdmin>;

  beforeEach(async () => {
    const requestConextMock = moq.Mock.ofType<AuthorizedFrontendRequestContext>();
    configureForPromiseResult(requestConextMock);
    sinon.stub(AuthorizedFrontendRequestContext, "create").resolves(requestConextMock.object);

    settingsAdminMock = moq.Mock.ofType<SettingsAdmin>();
    settingsAdminMock.setup((x) => x.getUserSetting(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
      status: SettingsStatus.Success,
      setting: {
        nestedContentInfos: new Set<string>(),
        propertyInfos: new Set<string>(),
        baseFieldInfos: new Set<string>(),
      },
    }));
    settingsAdminMock.setup((x) => x.saveUserSetting(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
      status: SettingsStatus.Success,
    }));
    sinon.stub(IModelApp, "settings").get(() => settingsAdminMock.object);

    storage = new IModelAppFavoritePropertiesStorage();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("loadProperties", () => {

    it("returns favorite properties", async () => {
      const properties = await storage.loadProperties();
      expect(properties).to.be.not.undefined;
      expect(properties!.propertyInfos.size).to.eq(0);
      expect(properties!.baseFieldInfos.size).to.eq(0);
    });

    it("returns undefined", async () => {
      settingsAdminMock.reset();
      settingsAdminMock.setup((x) => x.getUserSetting(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.UnknownError,
        setting: undefined,
      }));
      sinon.stub(IModelApp, "settings").get(() => settingsAdminMock.object);

      const properties = await storage.loadProperties();
      expect(properties).to.be.undefined;
    });

  });

  describe("saveProperties", () => {

    it("saves favorite properties", async () => {
      const nestedContentInfo = "nestedContentInfo";
      const propertyInfo = "propertyInfo";
      const baseFieldInfo = "baseFieldInfo";
      const properties: FavoriteProperties = {
        nestedContentInfos: new Set<string>([nestedContentInfo]),
        propertyInfos: new Set<string>([propertyInfo]),
        baseFieldInfos: new Set<string>([baseFieldInfo]),
      };

      await storage.saveProperties(properties);

      settingsAdminMock.verify(async (x) => x.saveUserSetting(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.once());
    });

  });

});
