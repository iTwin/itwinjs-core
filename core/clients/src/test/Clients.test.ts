/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { UrlDiscoveryClient } from "../Client";
import { ImsFederatedAuthenticationClient, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "../ImsClients";
import { ConnectClient, RbacClient } from "../ConnectClients";
import { IModelBaseHandler } from "..";
import { IModelWebNavigatorClient } from "../IModelWebNavigatorClient";
import { RealityDataServicesClient } from "../RealityDataServicesClient";
import { TileDataAccessClient } from "../TileDataAccessClient";
import { TilesGeneratorClient } from "../TilesGeneratorClient";
import { RbacUrlMock, ConnectUrlMock } from "./ConnectClients.test";
import { IModelHubUrlMock } from "./imodelhub/TestUtils";
import { IModelWebNavigatorUrlMock } from "./IModelWebNavigatorClient.test";
import { FederatedImsUrlMock, ActiveImsUrlMock, DelegationImsUrlMock } from "./ImsClients.test";
import { TilesGeneratorUrlMock } from "./TilesGeneratorClient.test";
import { TilesDataUrlMock } from "./TileDataAccessClient.test";
import { RealityDataUrlMock } from "./RealityDataServicesClient.test";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

chai.should();

describe("UrlDiscoveryClient", () => {
  const urlDiscoveryClient: UrlDiscoveryClient = new UrlDiscoveryClient("PROD"); // TODO: QA or DEV don't seem to work.
  const actx = new ActivityLoggingContext("");

  it("should setup its URLs correctly", async () => {
    let url: string = await new UrlDiscoveryClient("DEV").getUrl();
    chai.expect(url).equals("https://dev-buddi-eus2.cloudapp.net/WebService");

    url = await new UrlDiscoveryClient("QA").getUrl();
    chai.expect(url).equals("https://qa-buddi-eus2.cloudapp.net/WebService");

    url = await new UrlDiscoveryClient("PROD").getUrl();
    chai.expect(url).equals("https://buddi.bentley.com/WebService");

    url = await new UrlDiscoveryClient("PERF").getUrl();
    chai.expect(url).equals("https://qa-buddi-eus2.cloudapp.net/WebService");
  });

  it("should discover RBAC URLs correctly", async () => {
    RbacUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(actx, RbacClient.searchKey, "DEV");
    chai.expect(url).equals("https://dev-rbac-eus.cloudapp.net");

    RbacUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(actx, RbacClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-connect-rbac.bentley.com");

    RbacUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(actx, RbacClient.searchKey, "PROD");
    chai.expect(url).equals("https://connect-rbac.bentley.com");

    RbacUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(actx, RbacClient.searchKey, "PERF");
    chai.expect(url).equals("https://perf-rbac-eus.cloudapp.net");
  });

  it("should discover ConnectService URLs correctly", async () => {
    ConnectUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(actx, ConnectClient.searchKey, "DEV");
    chai.expect(url).equals("https://dev-connect-contextregistry.bentley.com");

    ConnectUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(actx, ConnectClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-connect-contextregistry.bentley.com");

    ConnectUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(actx, ConnectClient.searchKey, "PROD");
    chai.expect(url).equals("https://connect-wsg20.bentley.com");

    ConnectUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(actx, ConnectClient.searchKey, "PERF");
    chai.expect(url).equals("https://perf-connect-contextregistry.bentley.com");
    console.log(url); // tslint:disable-line:no-console
  });

  it("should discover IModelHubService URLs correctly", async () => {
    IModelHubUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(actx, IModelBaseHandler.searchKey, "DEV");
    chai.expect(url).equals("https://dev-imodelhubapi.bentley.com");

    IModelHubUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(actx, IModelBaseHandler.searchKey, "QA");
    chai.expect(url).equals("https://qa-imodelhubapi.bentley.com");

    IModelHubUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(actx, IModelBaseHandler.searchKey, "PROD");
    chai.expect(url).equals("https://imodelhubapi.bentley.com");

    IModelHubUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(actx, IModelBaseHandler.searchKey, "PERF");
    chai.expect(url).equals("https://perf-imodelhubapi.bentley.com");
  });

  it("should discover IModelWebNavigatorClient URLs correctly", async () => {
    IModelWebNavigatorUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(actx, IModelWebNavigatorClient.searchKey, "DEV");
    chai.expect(url).equals("https://dev-connect-imodelweb.bentley.com");

    IModelWebNavigatorUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(actx, IModelWebNavigatorClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-connect-imodelweb.bentley.com");

    IModelWebNavigatorUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(actx, IModelWebNavigatorClient.searchKey, "PROD");
    chai.expect(url).equals("https://connect-imodelweb.bentley.com");

    IModelWebNavigatorUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(actx, IModelWebNavigatorClient.searchKey, "PERF");
    chai.expect(url).equals("https://connect-imodelweb.bentley.com");
  });

  it("should discover ImsFederatedAuthenticationService URLs correctly", async () => {
    FederatedImsUrlMock.mockGetUrl("DEV");
    let url: string = await urlDiscoveryClient.discoverUrl(actx, ImsFederatedAuthenticationClient.searchKey, "DEV");
    chai.expect(url).equals("https://qa-ims.bentley.com");

    FederatedImsUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(actx, ImsFederatedAuthenticationClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-ims.bentley.com");

    FederatedImsUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(actx, ImsFederatedAuthenticationClient.searchKey, "PROD");
    chai.expect(url).equals("https://ims.bentley.com");

    FederatedImsUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(actx, ImsFederatedAuthenticationClient.searchKey, "PERF");
    chai.expect(url).equals("https://qa-ims.bentley.com");
  });

  it("should discover ImsActiveSecureTokenService URLs correctly", async () => {
    ActiveImsUrlMock.mockGetUrl("DEV");
    let url: string = await urlDiscoveryClient.discoverUrl(actx, ImsActiveSecureTokenClient.searchKey, "DEV");
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx");

    ActiveImsUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(actx, ImsActiveSecureTokenClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx");

    ActiveImsUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(actx, ImsActiveSecureTokenClient.searchKey, "PROD");
    chai.expect(url).equals("https://ims.bentley.com/rest/ActiveSTSService/json/IssueEx");

    ActiveImsUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(actx, ImsActiveSecureTokenClient.searchKey, "PERF");
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx");
  });

  it("should discover ImsDelegationSecureTokenService URLs correctly", async () => {
    DelegationImsUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(actx, ImsDelegationSecureTokenClient.searchKey, "DEV");
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/DelegationSTSService");

    DelegationImsUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(actx, ImsDelegationSecureTokenClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/DelegationSTSService");

    DelegationImsUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(actx, ImsDelegationSecureTokenClient.searchKey, "PROD");
    chai.expect(url).equals("https://ims.bentley.com/rest/DelegationSTSService");

    DelegationImsUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(actx, ImsDelegationSecureTokenClient.searchKey, "PERF");
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/DelegationSTSService");
  });

  it("should discover RealityDataServicesClient URLs correctly", async () => {
    RealityDataUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(actx, RealityDataServicesClient.searchKey, "DEV");
    chai.expect(url).equals("https://dev-realitydataservices-eus.cloudapp.net");

    RealityDataUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(actx, RealityDataServicesClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-connect-realitydataservices.bentley.com");

    RealityDataUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(actx, RealityDataServicesClient.searchKey, "PROD");
    chai.expect(url).equals("https://connect-realitydataservices.bentley.com");

    RealityDataUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(actx, RealityDataServicesClient.searchKey, "PERF");
    chai.expect(url).equals("https://perf-realitydataservices-eus.cloudapp.net");
  });

  it("should discover TileDataAccessClient URLs correctly", async () => {
    TilesDataUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(actx, TileDataAccessClient.searchKey, "DEV");
    chai.expect(url).equals("https://dev-connect-tilesdataaccess.bentley.com");

    TilesDataUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(actx, TileDataAccessClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-connect-tilesdataaccess.bentley.com");

    TilesDataUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(actx, TileDataAccessClient.searchKey, "PROD");
    chai.expect(url).equals("https://connect-tilesdataaccess.bentley.com");

    TilesDataUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(actx, TileDataAccessClient.searchKey, "PERF");
    chai.expect(url).equals("https://perf-connect-tilesdataaccess.bentley.com");
  });

  it("should discover TilesGeneratorClient URLs correctly", async () => {
    TilesGeneratorUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(actx, TilesGeneratorClient.searchKey, "DEV");
    chai.expect(url).equals("https://dev-3dtilesgenerator.bentley.com");

    TilesGeneratorUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(actx, TilesGeneratorClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-3dtilesgenerator.bentley.com");

    TilesGeneratorUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(actx, TilesGeneratorClient.searchKey, "PROD");
    chai.expect(url).equals("https://3dtilesgenerator.bentley.com");

    TilesGeneratorUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(actx, TilesGeneratorClient.searchKey, "PERF");
    chai.expect(url).equals("https://perf-3dtilesgenerator.bentley.com");
  });

});
