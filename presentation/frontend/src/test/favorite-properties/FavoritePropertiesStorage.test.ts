/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { AccessToken, BeEvent } from "@itwin/core-bentley";
import { AuthorizationClient, InternetConnectivityStatus } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { configureForPromiseResult, ResolvablePromise } from "@itwin/presentation-common/lib/cjs/test";
import { SettingsAdmin, SettingsStatus } from "@bentley/product-settings-client";
import { IConnectivityInformationProvider } from "../../presentation-frontend/ConnectivityInformationProvider";
import { FavoritePropertiesOrderInfo, PropertyFullName } from "../../presentation-frontend/favorite-properties/FavoritePropertiesManager";
import {
  BrowserLocalFavoritePropertiesStorage, createFavoritePropertiesStorage, DefaultFavoritePropertiesStorageTypes, IModelAppFavoritePropertiesStorage,
  NoopFavoritePropertiesStorage, OfflineCachingFavoritePropertiesStorage,
} from "../../presentation-frontend/favorite-properties/FavoritePropertiesStorage";

describe("IModelAppFavoritePropertiesStorage", () => {

  let storage: IModelAppFavoritePropertiesStorage;
  let settingsAdminMock: moq.IMock<SettingsAdmin>;
  let authorizationClientMock: moq.IMock<AuthorizationClient>;

  beforeEach(async () => {
    const requestConextMock = moq.Mock.ofType<AccessToken>();
    configureForPromiseResult(requestConextMock);
    sinon.stub(IModelApp, "settings").get(() => settingsAdminMock.object);

    authorizationClientMock = moq.Mock.ofType<AuthorizationClient>();
    const accessToken: AccessToken = "TestToken";
    authorizationClientMock.setup(async (x) => x.getAccessToken()).returns(async () => Promise.resolve(accessToken));
    IModelApp.authorizationClient = authorizationClientMock.object;

    storage = new IModelAppFavoritePropertiesStorage();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("loadProperties", () => {

    it("returns favorite properties", async () => {
      settingsAdminMock = moq.Mock.ofType<SettingsAdmin>();
      settingsAdminMock.setup(async (x) => x.getUserSetting(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.Success,
        setting: [],
      }));

      const properties = await storage.loadProperties();
      expect(properties).to.be.not.undefined;
      expect(properties!.size).to.eq(0);
    });

    it("is backwards compatible", async () => {
      settingsAdminMock = moq.Mock.ofType<SettingsAdmin>();
      settingsAdminMock.setup(async (x) => x.getUserSetting(moq.It.isAny(), "imodeljs.presentation", moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.Success,
        setting: undefined,
      }));
      settingsAdminMock.setup(async (x) => x.getUserSetting(moq.It.isAny(), "Properties", moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
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
      settingsAdminMock.setup(async (x) => x.getUserSetting(moq.It.isAny(), "imodeljs.presentation", moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.UnknownError,
        setting: undefined,
      }));
      settingsAdminMock.setup(async (x) => x.getUserSetting(moq.It.isAny(), "Properties", moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.UnknownError,
        setting: undefined,
      }));

      const properties = await storage.loadProperties();
      expect(properties).to.be.undefined;
    });

    it("throws when not signed in", async () => {
      authorizationClientMock.reset();
      authorizationClientMock.setup(async (x) => x.getAccessToken()).returns(async () => Promise.resolve(""));
      await expect(storage.loadProperties()).to.eventually.be.rejected;
    });

  });

  describe("saveProperties", () => {

    it("saves favorite properties", async () => {
      settingsAdminMock.setup(async (x) => x.saveUserSetting(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.Success,
      }));

      const properties = new Set<PropertyFullName>(["propertyInfo1", "propertyInfo2"]);
      await storage.saveProperties(properties);
      settingsAdminMock.verify(async (x) => x.saveUserSetting(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), undefined, undefined), moq.Times.once());
    });

    it("throws when not signed in", async () => {
      authorizationClientMock.reset();
      authorizationClientMock.setup(async (x) => x.getAccessToken()).returns(async () => Promise.resolve(""));
      await expect(storage.saveProperties(new Set())).to.eventually.be.rejected;
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
      settingsAdminMock.setup(async (x) => x.getUserSetting(moq.It.isAny(), "imodeljs.presentation", "FavoritePropertiesOrderInfo", moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.Success,
        setting: [orderInfo],
      }));

      const properties = await storage.loadPropertiesOrder("iTwinId", "imodelId");
      expect(properties).to.be.not.undefined;
      expect(properties!.length).to.eq(1);
      expect(properties![0]).to.eq(orderInfo);
    });

    it("returns undefined", async () => {
      settingsAdminMock.setup(async (x) => x.getUserSetting(moq.It.isAny(), "imodeljs.presentation", "FavoritePropertiesOrderInfo", moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.UnknownError,
        setting: undefined,
      }));
      sinon.stub(IModelApp, "settings").get(() => settingsAdminMock.object);

      const properties = await storage.loadPropertiesOrder("iTwinId", "imodelId");
      expect(properties).to.be.undefined;
    });

    it("throws when not signed in", async () => {
      authorizationClientMock.reset();
      authorizationClientMock.setup(async (x) => x.getAccessToken()).returns(async () => Promise.resolve(""));
      await expect(storage.loadPropertiesOrder("iTwinId", "imodelId")).to.eventually.be.rejected;
    });

  });

  describe("savePropertiesOrder", () => {

    it("saves properties order", async () => {
      settingsAdminMock.setup(async (x) => x.saveUserSetting(moq.It.isAny(), moq.It.isAny(), "imodeljs.presentation", "FavoritePropertiesOrderInfo", moq.It.isAny())).returns(async () => ({
        status: SettingsStatus.Success,
      }));

      const orderInfo: FavoritePropertiesOrderInfo = {
        parentClassName: undefined,
        name: "orderInfoName",
        priority: 5,
        orderedTimestamp: new Date(),
      };

      await storage.savePropertiesOrder([orderInfo], "iTwinId", "imodelId");
      settingsAdminMock.verify(async (x) => x.saveUserSetting(moq.It.isAny(), moq.It.isAny(), "imodeljs.presentation", "FavoritePropertiesOrderInfo", moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.once());
    });

    it("throws when not signed in", async () => {
      authorizationClientMock.reset();
      authorizationClientMock.setup(async (x) => x.getAccessToken()).returns(async () => Promise.resolve(""));
      await expect(storage.savePropertiesOrder([], "iTwinId", "imodelId")).to.eventually.be.rejected;
    });

  });

});

describe("OfflineCachingFavoritePropertiesStorage", () => {

  const impl = {
    loadProperties: sinon.stub(),
    saveProperties: sinon.stub(),
    loadPropertiesOrder: sinon.stub(),
    savePropertiesOrder: sinon.stub(),
  };
  const connectivityInfo: IConnectivityInformationProvider = {
    onInternetConnectivityChanged: new BeEvent(),
    status: InternetConnectivityStatus.Offline,
  };
  let storage: OfflineCachingFavoritePropertiesStorage;

  beforeEach(() => {
    impl.loadProperties.reset();
    impl.loadPropertiesOrder.reset();
    impl.saveProperties.reset();
    impl.savePropertiesOrder.reset();
    connectivityInfo.onInternetConnectivityChanged.clear();
    storage = new OfflineCachingFavoritePropertiesStorage({ impl, connectivityInfo });
  });

  afterEach(() => {
    storage.dispose();
    sinon.restore();
  });

  describe("saveProperties", () => {

    describe("when offline", () => {

      beforeEach(() => {
        sinon.stub(connectivityInfo, "status").get(() => InternetConnectivityStatus.Offline);
      });

      it("saves properties to cache", async () => {
        await storage.saveProperties(new Set());
        expect(impl.saveProperties).to.not.be.called;
      });

    });

    describe("when online", () => {

      beforeEach(() => {
        sinon.stub(connectivityInfo, "status").get(() => InternetConnectivityStatus.Online);
      });

      it("saves properties and clears offline cache when `impl` succeeds", async () => {
        // add something to offline cache
        await offline(async () => storage.saveProperties(new Set(["a"]), "b", "c"));
        expect(await offline(async () => storage.loadProperties("b", "c"))).to.not.be.undefined;
        // call save while online
        const set = new Set(["d"]);
        await storage.saveProperties(set, "b", "c");
        expect(impl.saveProperties).to.be.calledOnceWith(set, "b", "c");
        // verify the offline cache is empty
        expect(await offline(async () => storage.loadProperties("b", "c"))).to.be.undefined;
      });

      it("saves properties and doesn't clear offline cache when `impl` request succeeds after offline call", async () => {
        const implPromise = new ResolvablePromise<void>();
        impl.saveProperties.returns(implPromise);
        const result = Promise.all([
          online(async () => storage.saveProperties(new Set(["1"]), "x", "z")),
          offline(async () => storage.saveProperties(new Set(["2"]), "x", "z")),
        ]);
        expect(impl.saveProperties).to.be.calledOnce;
        await implPromise.resolve();
        await result;
        // verify the offline cache now contains value of the most recent `saveProperties` call
        expect(await offline(async () => storage.loadProperties("x", "z"))).to.contain("2");
      });

      it("saves properties and puts them to offline cache when `impl` fails", async () => {
        // add something to offline cache
        await offline(async () => storage.saveProperties(new Set(["a"]), "b", "c"));
        expect(await offline(async () => storage.loadProperties("b", "c"))).to.not.be.undefined;
        // call save while online
        impl.saveProperties.returns(Promise.reject());
        const set = new Set(["d"]);
        await storage.saveProperties(set, "b", "c");
        expect(impl.saveProperties).to.be.calledOnceWith(set, "b", "c");
        // verify the offline cache now contains value of the most recent `saveProperties` call
        const result = await offline(async () => storage.loadProperties("b", "c"));
        expect(result?.size).to.eq(1);
        expect(result).to.contain("d");
      });

      it("stores properties to offline cache the last value when two `impl` requests fail in sequence", async () => {
        const implPromises = [0, 1].map(() => new ResolvablePromise<void>());
        impl.saveProperties.resetBehavior();
        impl.saveProperties.onFirstCall().returns(implPromises[0]);
        impl.saveProperties.onSecondCall().returns(implPromises[1]);
        const result = Promise.all([
          storage.saveProperties(new Set(["1"]), "x", "z"),
          storage.saveProperties(new Set(["2"]), "x", "z"),
        ]);
        expect(impl.saveProperties).to.be.calledTwice;
        implPromises.forEach(async (promise) => promise.reject());
        await result;
        // verify the offline cache now contains value of the most recent `saveProperties` call
        expect(await offline(async () => storage.loadProperties("x", "z"))).to.contain("2");
      });

      it("stores properties to offline cache the last value when two `impl` requests fail in opposite order", async () => {
        const implPromises = [0, 1].map(() => new ResolvablePromise<void>());
        impl.saveProperties.resetBehavior();
        impl.saveProperties.onFirstCall().returns(implPromises[0]);
        impl.saveProperties.onSecondCall().returns(implPromises[1]);
        const result = Promise.all([
          storage.saveProperties(new Set(["1"]), "x", "z"),
          storage.saveProperties(new Set(["2"]), "x", "z"),
        ]);
        expect(impl.saveProperties).to.be.calledTwice;
        implPromises.reverse().forEach(async (promise) => promise.reject());
        await result;
        // verify the offline cache now contains value of the most recent `saveProperties` call
        expect(await offline(async () => storage.loadProperties("x", "z"))).to.contain("2");
      });

      it("stores properties to offline cache the last value when `impl` request fails before offline call", async () => {
        impl.saveProperties.returns(Promise.reject());
        const result = Promise.all([
          online(async () => storage.saveProperties(new Set(["1"]), "x", "z")),
          offline(async () => storage.saveProperties(new Set(["2"]), "x", "z")),
        ]);
        expect(impl.saveProperties).to.be.calledOnce;
        await result;
        // verify the offline cache now contains value of the most recent `saveProperties` call
        expect(await offline(async () => storage.loadProperties("x", "z"))).to.contain("2");
      });

      it("stores properties to offline cache the last value when `impl` request fails after offline call", async () => {
        const implPromise = new ResolvablePromise<void>();
        impl.saveProperties.returns(implPromise);
        const result = Promise.all([
          online(async () => storage.saveProperties(new Set(["1"]), "x", "z")),
          offline(async () => storage.saveProperties(new Set(["2"]), "x", "z")),
        ]);
        expect(impl.saveProperties).to.be.calledOnce;
        await implPromise.reject();
        await result;
        // verify the offline cache now contains value of the most recent `saveProperties` call
        expect(await offline(async () => storage.loadProperties("x", "z"))).to.contain("2");
      });

    });

  });

  describe("loadProperties", () => {

    describe("when offline", () => {

      beforeEach(() => {
        sinon.stub(connectivityInfo, "status").get(() => InternetConnectivityStatus.Offline);
      });

      it("returns `undefined`and there's no cached value", async () => {
        const result = await storage.loadProperties("a", "b");
        expect(result).to.be.undefined;
      });

      it("loads from cache and there's cached value", async () => {
        await storage.saveProperties(new Set(["test1", "test2"]), "a", "b");
        const result = await storage.loadProperties("a", "b");
        expect(impl.loadProperties).to.not.be.called;
        expect(result?.size).to.eq(2);
        expect(result).to.contain("test1");
        expect(result).to.contain("test2");
      });

    });

    describe("when online", () => {

      beforeEach(() => {
        sinon.stub(connectivityInfo, "status").get(() => InternetConnectivityStatus.Online);
      });

      it("loads properties from `impl`", async () => {
        impl.loadProperties.returns(Promise.resolve(undefined));
        await storage.loadProperties("a", "b");
        expect(impl.loadProperties).to.be.calledOnce;
      });

      it("loads from cache if `impl` load fails", async () => {
        await offline(async () => storage.saveProperties(new Set(["cached"]), "a", "b"));
        impl.loadProperties.returns(Promise.reject());
        const result = await storage.loadProperties("a", "b");
        expect(impl.loadProperties).to.be.calledOnce;
        expect(result?.size).to.eq(1);
        expect(result).to.contain("cached");
      });

    });

  });

  describe("savePropertiesOrder", () => {

    describe("when offline", () => {

      beforeEach(() => {
        sinon.stub(connectivityInfo, "status").get(() => InternetConnectivityStatus.Offline);
      });

      it("saves properties order to cache", async () => {
        await storage.savePropertiesOrder([createRandomPropertiesOrderInfo()], "a", "b");
        expect(impl.savePropertiesOrder).to.not.be.called;
      });

    });

    describe("when online", () => {

      beforeEach(() => {
        sinon.stub(connectivityInfo, "status").get(() => InternetConnectivityStatus.Online);
      });

      it("saves properties order and clears offline cache when `impl` succeeds", async () => {
        // add something to offline cache
        await offline(async () => storage.savePropertiesOrder([createRandomPropertiesOrderInfo()], "b", "c"));
        expect(await offline(async () => storage.loadPropertiesOrder("b", "c"))).to.not.be.undefined;
        // call save while online
        const order = createRandomPropertiesOrderInfo();
        await storage.savePropertiesOrder([order], "b", "c");
        expect(impl.savePropertiesOrder).to.be.calledOnceWith([order], "b", "c");
        // verify the offline cache is empty
        expect(await offline(async () => storage.loadPropertiesOrder("b", "c"))).to.be.undefined;
      });

      it("saves properties order and doesn't clear offline cache when `impl` request succeeds after offline call", async () => {
        const orderInfos = [0, 1].map(() => createRandomPropertiesOrderInfo());
        const implPromise = new ResolvablePromise<void>();
        impl.saveProperties.returns(implPromise);
        const result = Promise.all([
          online(async () => storage.savePropertiesOrder([orderInfos[0]], "x", "z")),
          offline(async () => storage.savePropertiesOrder([orderInfos[1]], "x", "z")),
        ]);
        expect(impl.savePropertiesOrder).to.be.calledOnce;
        await implPromise.resolve();
        await result;
        // verify the offline cache now contains value of the most recent `savePropertiesOrder` call
        expect(await offline(async () => storage.loadPropertiesOrder("x", "z"))).to.contain(orderInfos[1]);
      });

      it("saves properties order and puts them to offline cache when `impl` fails", async () => {
        // add something to offline cache
        await offline(async () => storage.savePropertiesOrder([createRandomPropertiesOrderInfo()], "b", "c"));
        expect(await offline(async () => storage.loadPropertiesOrder("b", "c"))).to.not.be.undefined;
        // call save while online
        impl.savePropertiesOrder.returns(Promise.reject());
        const order = createRandomPropertiesOrderInfo();
        await storage.savePropertiesOrder([order], "b", "c");
        expect(impl.savePropertiesOrder).to.be.calledOnceWith([order], "b", "c");
        // verify the offline cache now contains value of the most recent `savePropertiesOrder` call
        const result = await offline(async () => storage.loadPropertiesOrder("b", "c"));
        expect(result?.length).to.eq(1);
        expect(result).to.contain(order);
      });

      it("stores properties order to offline cache the last value when two `impl` requests fail in sequence", async () => {
        const orderInfos = [0, 1].map(() => createRandomPropertiesOrderInfo());
        const implPromises = [0, 1].map(() => new ResolvablePromise<void>());
        impl.savePropertiesOrder.resetBehavior();
        impl.savePropertiesOrder.onFirstCall().returns(implPromises[0]);
        impl.savePropertiesOrder.onSecondCall().returns(implPromises[1]);
        const result = Promise.all(orderInfos.map(async (order) => storage.savePropertiesOrder([order], "x", "z")));
        expect(impl.savePropertiesOrder).to.be.calledTwice;
        implPromises.forEach(async (promise) => promise.reject());
        await result;
        // verify the offline cache now contains value of the most recent `savePropertiesOrder` call
        expect(await offline(async () => storage.loadPropertiesOrder("x", "z"))).to.contain(orderInfos[1]);
      });

      it("stores properties order to offline cache the last value when two `impl` requests fail in opposite order", async () => {
        const orderInfos = [0, 1].map(() => createRandomPropertiesOrderInfo());
        const implPromises = [0, 1].map(() => new ResolvablePromise<void>());
        impl.savePropertiesOrder.resetBehavior();
        impl.savePropertiesOrder.onFirstCall().returns(implPromises[0]);
        impl.savePropertiesOrder.onSecondCall().returns(implPromises[1]);
        const result = Promise.all(orderInfos.map(async (order) => storage.savePropertiesOrder([order], "x", "z")));
        expect(impl.savePropertiesOrder).to.be.calledTwice;
        implPromises.reverse().forEach(async (promise) => promise.reject());
        await result;
        // verify the offline cache now contains value of the most recent `savePropertiesOrder` call
        expect(await offline(async () => storage.loadPropertiesOrder("x", "z"))).to.contain(orderInfos[1]);
      });

      it("stores properties order to offline cache the last value when `impl` request fails before offline call", async () => {
        const orderInfos = [0, 1].map(() => createRandomPropertiesOrderInfo());
        impl.savePropertiesOrder.returns(Promise.reject());
        const result = Promise.all([
          online(async () => storage.savePropertiesOrder([orderInfos[0]], "x", "z")),
          offline(async () => storage.savePropertiesOrder([orderInfos[1]], "x", "z")),
        ]);
        expect(impl.savePropertiesOrder).to.be.calledOnce;
        await result;
        // verify the offline cache now contains value of the most recent `savePropertiesOrder` call
        expect(await offline(async () => storage.loadPropertiesOrder("x", "z"))).to.contain(orderInfos[1]);
      });

      it("stores properties order to offline cache the last value when `impl` request fails after offline call", async () => {
        const orderInfos = [0, 1].map(() => createRandomPropertiesOrderInfo());
        const implPromise = new ResolvablePromise<void>();
        impl.savePropertiesOrder.returns(implPromise);
        const result = Promise.all([
          online(async () => storage.savePropertiesOrder([orderInfos[0]], "x", "z")),
          offline(async () => storage.savePropertiesOrder([orderInfos[1]], "x", "z")),
        ]);
        expect(impl.savePropertiesOrder).to.be.calledOnce;
        await implPromise.reject();
        await result;
        // verify the offline cache now contains value of the most recent `savePropertiesOrder` call
        expect(await offline(async () => storage.loadPropertiesOrder("x", "z"))).to.contain(orderInfos[1]);
      });

    });

  });

  describe("loadPropertiesOrder", () => {

    describe("when offline", () => {

      beforeEach(() => {
        sinon.stub(connectivityInfo, "status").get(() => InternetConnectivityStatus.Offline);
      });

      it("returns `undefined` and there's no cached value", async () => {
        const result = await storage.loadPropertiesOrder("a", "b");
        expect(result).to.be.undefined;
      });

      it("loads from cache and there's cached value", async () => {
        const orderInfo = createRandomPropertiesOrderInfo();
        await storage.savePropertiesOrder([orderInfo], "a", "b");
        const result = await storage.loadPropertiesOrder("a", "b");
        expect(impl.loadPropertiesOrder).to.not.be.called;
        expect(result?.length).to.eq(1);
        expect(result).to.contain(orderInfo);
      });

    });

    describe("when online", () => {

      beforeEach(() => {
        sinon.stub(connectivityInfo, "status").get(() => InternetConnectivityStatus.Online);
      });

      it("loads properties from `impl`", async () => {
        impl.loadPropertiesOrder.returns(Promise.resolve(undefined));
        await storage.loadPropertiesOrder("a", "b");
        expect(impl.loadPropertiesOrder).to.be.calledOnce;
      });

      it("loads from cache if `impl` load fails", async () => {
        const order = createRandomPropertiesOrderInfo();
        await offline(async () => storage.savePropertiesOrder([order], "a", "b"));
        impl.loadPropertiesOrder.returns(Promise.reject());
        const result = await storage.loadPropertiesOrder("a", "b");
        expect(impl.loadPropertiesOrder).to.be.calledOnce;
        expect(result?.length).to.eq(1);
        expect(result).to.contain(order);
      });

    });

  });

  describe("reacting to connectivity status changes", () => {

    it("saves cached offline properties and order when comes online", async () => {
      // store some data to offline cache
      const propertiesSet = new Set(["a"]);
      const orderInfo = createRandomPropertiesOrderInfo();
      await offline(async () => storage.saveProperties(propertiesSet, "b", "c"));
      await offline(async () => storage.savePropertiesOrder([orderInfo], "b", "c"));
      expect(impl.saveProperties).to.not.be.called;
      expect(impl.savePropertiesOrder).to.not.be.called;

      // notify the connection status changed to 'online'
      sinon.stub(connectivityInfo, "status").get(() => InternetConnectivityStatus.Online);
      connectivityInfo.onInternetConnectivityChanged.raiseEvent({ status: InternetConnectivityStatus.Online });

      // expect properties and order to be synced with `impl` and removed from offline cache
      expect(impl.saveProperties).to.be.calledOnceWith(propertiesSet, "b", "c");
      expect(impl.savePropertiesOrder).to.be.calledOnceWith([orderInfo], "b", "c");
      expect(await offline(async () => storage.loadProperties("b", "c"))).to.be.undefined;
      expect(await offline(async () => storage.loadPropertiesOrder("b", "c"))).to.be.undefined;
    });

  });

  it("disposes IConnectivityInformationProvider", () => {
    const disposableConnectivityInfo = {
      onInternetConnectivityChanged: new BeEvent(),
      status: InternetConnectivityStatus.Offline,
      dispose: sinon.spy(),
    };
    storage = new OfflineCachingFavoritePropertiesStorage({ impl, connectivityInfo: disposableConnectivityInfo });
    storage.dispose();
    expect(disposableConnectivityInfo.dispose).to.be.calledOnce;
  });

  const callInConnectivityContext = async <T>(cb: (() => Promise<T>), connectivityStatus: InternetConnectivityStatus) => {
    const stub = sinon.stub(connectivityInfo, "status").get(() => connectivityStatus);
    const result = await cb();
    stub.restore();
    return result;
  };

  const offline = async <T>(cb: (() => Promise<T>)) => {
    return callInConnectivityContext(cb, InternetConnectivityStatus.Offline);
  };

  const online = async <T>(cb: (() => Promise<T>)) => {
    return callInConnectivityContext(cb, InternetConnectivityStatus.Online);
  };

});

describe("BrowserLocalFavoritePropertiesStorage", () => {

  let storage: BrowserLocalFavoritePropertiesStorage;
  let storageMock: moq.IMock<Storage>;

  beforeEach(() => {
    storageMock = moq.Mock.ofType<Storage>();
    storage = new BrowserLocalFavoritePropertiesStorage({ localStorage: storageMock.object });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("saveProperties", () => {

    it("saves properties to local storage", async () => {
      await storage.saveProperties(new Set(["test"]), "a", "b");
      storageMock.verify((x) => x.setItem(storage.createFavoritesSettingItemKey("a", "b"), `["test"]`), moq.Times.once());
    });

  });

  describe("loadProperties", () => {

    it("returns `undefined`and there's no cached value", async () => {
      storageMock.setup((x) => x.getItem(moq.It.isAny())).returns(() => null);
      const result = await storage.loadProperties("a", "b");
      expect(result).to.be.undefined;
    });

    it("loads from local storage where there's a value", async () => {
      storageMock.setup((x) => x.getItem(storage.createFavoritesSettingItemKey("a", "b"))).returns(() => `["abc", "def"]`).verifiable();
      const result = await storage.loadProperties("a", "b");
      storageMock.verifyAll();
      expect(result?.size).to.eq(2);
      expect(result).to.contain("abc");
      expect(result).to.contain("def");
    });

  });

  describe("savePropertiesOrder", () => {

    it("saves properties order to local storage", async () => {
      const orderInfos = [createRandomPropertiesOrderInfo()];
      await storage.savePropertiesOrder(orderInfos, "a", "b");
      storageMock.verify((x) => x.setItem(storage.createOrderSettingItemKey("a", "b"), JSON.stringify(orderInfos)), moq.Times.once());
    });

  });

  describe("loadPropertiesOrder", () => {

    it("returns `undefined` and there's no cached value", async () => {
      storageMock.setup((x) => x.getItem(moq.It.isAny())).returns(() => null);
      const result = await storage.loadPropertiesOrder("a", "b");
      expect(result).to.be.undefined;
    });

    it("loads from cache and there's cached value", async () => {
      const orderInfos = [createRandomPropertiesOrderInfo()];
      storageMock.setup((x) => x.getItem(storage.createOrderSettingItemKey("a", "b"))).returns(() => JSON.stringify(orderInfos)).verifiable();
      const result = await storage.loadPropertiesOrder("a", "b");
      storageMock.verifyAll();
      expect(result).to.deep.eq(orderInfos);
    });

  });

});

const createRandomPropertiesOrderInfo = () => ({
  parentClassName: "parent.class.name",
  name: "full.property.name",
  priority: 9999,
  orderedTimestamp: new Date(),
});

describe("createFavoritePropertiesStorage", () => {

  afterEach(() => {
    sinon.restore();
  });

  it("creates noop storage", () => {
    const result = createFavoritePropertiesStorage(DefaultFavoritePropertiesStorageTypes.Noop);
    expect(result).to.be.instanceOf(NoopFavoritePropertiesStorage);
  });

  it("creates browser local storage", () => {
    sinon.stub(window, "localStorage").get(() => moq.Mock.ofType<Storage>().object);
    const result = createFavoritePropertiesStorage(DefaultFavoritePropertiesStorageTypes.BrowserLocalStorage);
    expect(result).to.be.instanceOf(BrowserLocalFavoritePropertiesStorage);
  });

  it("creates user settings service storage", () => {
    const result = createFavoritePropertiesStorage(DefaultFavoritePropertiesStorageTypes.UserSettingsServiceStorage);
    expect(result).to.be.instanceOf(OfflineCachingFavoritePropertiesStorage);
    expect((result as OfflineCachingFavoritePropertiesStorage).impl).to.be.instanceOf(IModelAppFavoritePropertiesStorage);
  });

});
