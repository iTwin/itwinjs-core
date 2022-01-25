/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { BeDuration } from "@itwin/core-bentley";
import { InternetConnectivityStatus } from "@itwin/core-common";
import { NativeApp } from "@itwin/core-frontend";
import { ResolvablePromise } from "@itwin/presentation-common/lib/cjs/test";
import { ConnectivityInformationProvider } from "../presentation-frontend/ConnectivityInformationProvider";
import { Presentation } from "../presentation-frontend/Presentation";

describe("ConnectivityInformationProvider", () => {

  let nativeAppCheckInternetConnectivityStub: sinon.SinonStub<[], PromiseLike<InternetConnectivityStatus>>;

  beforeEach(() => {
    nativeAppCheckInternetConnectivityStub = sinon.stub(NativeApp, "checkInternetConnectivity").returns(Promise.resolve(InternetConnectivityStatus.Offline));
  });

  afterEach(() => {
    Presentation.terminate();
  });

  describe("native app", () => {

    beforeEach(() => {
      sinon.stub(NativeApp, "isValid").get(() => true); // we're not really going to use any native methods, just events.
      NativeApp.onInternetConnectivityChanged.clear();
    });

    afterEach(() => {
    });

    describe("constructor", () => {

      it("sets current status to the result of `NativeApp.checkInternetConnectivity` if not set already", async () => {
        const internetConnectivityResult = new ResolvablePromise<InternetConnectivityStatus>();
        nativeAppCheckInternetConnectivityStub.returns(internetConnectivityResult);

        const provider = new ConnectivityInformationProvider();
        expect(provider.status).to.eq(InternetConnectivityStatus.Offline);

        await internetConnectivityResult.resolve(InternetConnectivityStatus.Online);
        expect(provider.status).to.eq(InternetConnectivityStatus.Online);
      });

      it("doesn't set current status to the result of `NativeApp.checkInternetConnectivity` if set already", async () => {
        const internetConnectivityResult = new ResolvablePromise<InternetConnectivityStatus>();
        nativeAppCheckInternetConnectivityStub.returns(internetConnectivityResult);

        const provider = new ConnectivityInformationProvider();
        expect(provider.status).to.eq(InternetConnectivityStatus.Offline);

        NativeApp.onInternetConnectivityChanged.raiseEvent(InternetConnectivityStatus.Offline);
        await internetConnectivityResult.resolve(InternetConnectivityStatus.Online);
        expect(provider.status).to.eq(InternetConnectivityStatus.Offline);
      });

    });

    describe("dispose", () => {

      it("unsubscribes from `NativeApp.onInternetConnectivityChanged` event", () => {
        const provider = new ConnectivityInformationProvider();
        expect(NativeApp.onInternetConnectivityChanged.numberOfListeners).to.eq(1);
        provider.dispose();
        expect(NativeApp.onInternetConnectivityChanged.numberOfListeners).to.eq(0);
      });

    });

    describe("status change listening", () => {

      it("raises `onInternetConnectivityChanged` event when `NativeApp.onInternetConnectivityChanged` is raised with different value", async () => {
        const provider = new ConnectivityInformationProvider();
        await BeDuration.wait(0); // let the promise in constructor resolve
        expect(provider.status).to.eq(InternetConnectivityStatus.Offline);

        const spy = sinon.spy();
        provider.onInternetConnectivityChanged.addListener(spy);

        NativeApp.onInternetConnectivityChanged.raiseEvent(InternetConnectivityStatus.Offline);
        expect(provider.status).to.eq(InternetConnectivityStatus.Offline);
        expect(spy).to.not.be.called;

        NativeApp.onInternetConnectivityChanged.raiseEvent(InternetConnectivityStatus.Online);
        expect(provider.status).to.eq(InternetConnectivityStatus.Online);
        expect(spy).to.be.calledOnce;

        NativeApp.onInternetConnectivityChanged.raiseEvent(InternetConnectivityStatus.Online);
        expect(provider.status).to.eq(InternetConnectivityStatus.Online);
        expect(spy).to.be.calledOnce;
      });

    });

  });

  describe("non native app", () => {

    describe("constructor", () => {

      it("sets current status to `Online`", () => {
        const provider = new ConnectivityInformationProvider();
        expect(provider.status).to.eq(InternetConnectivityStatus.Online);
      });

    });

  });

});
