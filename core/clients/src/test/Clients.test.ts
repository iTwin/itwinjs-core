/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { UrlDiscoveryClient } from "../Client";
import { ImsFederatedAuthentiationClient, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "../ImsClients";
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

chai.should();

describe("UrlDiscoveryClient", () => {
  const urlDiscoveryClient: UrlDiscoveryClient = new UrlDiscoveryClient("PROD"); // TODO: QA or DEV don't seem to work.

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
    let url = await urlDiscoveryClient.discoverUrl(RbacClient.searchKey, "DEV");
    chai.expect(url).equals("https://dev-rbac-eus.cloudapp.net");

    RbacUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(RbacClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-connect-rbac.bentley.com");

    RbacUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(RbacClient.searchKey, "PROD");
    chai.expect(url).equals("https://connect-rbac.bentley.com");

    RbacUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(RbacClient.searchKey, "PERF");
    chai.expect(url).equals("https://perf-rbac-eus.cloudapp.net");
  });

  it("should discover ConnectService URLs correctly", async () => {
    ConnectUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(ConnectClient.searchKey, "DEV");
    chai.expect(url).equals("https://dev-wsg20-eus.cloudapp.net");

    ConnectUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(ConnectClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-connect-wsg20.bentley.com");

    ConnectUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(ConnectClient.searchKey, "PROD");
    chai.expect(url).equals("https://connect-wsg20.bentley.com");

    ConnectUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(ConnectClient.searchKey, "PERF");
    chai.expect(url).equals("https://perf-wsg20-eus.cloudapp.net");
  });

  it("should discover IModelHubService URLs correctly", async () => {
    IModelHubUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(IModelBaseHandler.searchKey, "DEV");
    chai.expect(url).equals("https://dev-imodelhubapi.bentley.com");

    IModelHubUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(IModelBaseHandler.searchKey, "QA");
    chai.expect(url).equals("https://qa-imodelhubapi.bentley.com");

    IModelHubUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(IModelBaseHandler.searchKey, "PROD");
    chai.expect(url).equals("https://imodelhubapi.bentley.com");

    IModelHubUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(IModelBaseHandler.searchKey, "PERF");
    chai.expect(url).equals("https://perf-imodelhubapi.bentley.com");
  });

  it("should discover IModelWebNavigatorClient URLs correctly", async () => {
    IModelWebNavigatorUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(IModelWebNavigatorClient.searchKey, "DEV");
    chai.expect(url).equals("https://dev-connect-imodelweb.bentley.com");

    IModelWebNavigatorUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(IModelWebNavigatorClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-connect-imodelweb.bentley.com");

    IModelWebNavigatorUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(IModelWebNavigatorClient.searchKey, "PROD");
    chai.expect(url).equals("https://connect-imodelweb.bentley.com");

    IModelWebNavigatorUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(IModelWebNavigatorClient.searchKey, "PERF");
    chai.expect(url).equals("https://connect-imodelweb.bentley.com");
  });

  it("should discover ImsFederatedAuthentiationService URLs correctly", async () => {
    FederatedImsUrlMock.mockGetUrl("DEV");
    let url: string = await urlDiscoveryClient.discoverUrl(ImsFederatedAuthentiationClient.searchKey, "DEV");
    chai.expect(url).equals("https://qa-ims.bentley.com");

    FederatedImsUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(ImsFederatedAuthentiationClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-ims.bentley.com");

    FederatedImsUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(ImsFederatedAuthentiationClient.searchKey, "PROD");
    chai.expect(url).equals("https://ims.bentley.com");

    FederatedImsUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(ImsFederatedAuthentiationClient.searchKey, "PERF");
    chai.expect(url).equals("https://qa-ims.bentley.com");
  });

  it("should discover ImsActiveSecureTokenService URLs correctly", async () => {
    ActiveImsUrlMock.mockGetUrl("DEV");
    let url: string = await urlDiscoveryClient.discoverUrl(ImsActiveSecureTokenClient.searchKey, "DEV");
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx");

    ActiveImsUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(ImsActiveSecureTokenClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx");

    ActiveImsUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(ImsActiveSecureTokenClient.searchKey, "PROD");
    chai.expect(url).equals("https://ims.bentley.com/rest/ActiveSTSService/json/IssueEx");

    ActiveImsUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(ImsActiveSecureTokenClient.searchKey, "PERF");
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/ActiveSTSService/json/IssueEx");
  });

  it("should discover ImsDelegationSecureTokenService URLs correctly", async () => {
    DelegationImsUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(ImsDelegationSecureTokenClient.searchKey, "DEV");
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/DelegationSTSService");

    DelegationImsUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(ImsDelegationSecureTokenClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/DelegationSTSService");

    DelegationImsUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(ImsDelegationSecureTokenClient.searchKey, "PROD");
    chai.expect(url).equals("https://ims.bentley.com/rest/DelegationSTSService");

    DelegationImsUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(ImsDelegationSecureTokenClient.searchKey, "PERF");
    chai.expect(url).equals("https://qa-ims.bentley.com/rest/DelegationSTSService");
  });

  it("should discover RealityDataServicesClient URLs correctly", async () => {
    RealityDataUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(RealityDataServicesClient.searchKey, "DEV");
    chai.expect(url).equals("https://dev-realitydataservices-eus.cloudapp.net");

    RealityDataUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(RealityDataServicesClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-connect-realitydataservices.bentley.com");

    RealityDataUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(RealityDataServicesClient.searchKey, "PROD");
    chai.expect(url).equals("https://connect-realitydataservices.bentley.com");

    RealityDataUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(RealityDataServicesClient.searchKey, "PERF");
    chai.expect(url).equals("https://perf-realitydataservices-eus.cloudapp.net");
  });

  it("should discover TileDataAccessClient URLs correctly", async () => {
    TilesDataUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(TileDataAccessClient.searchKey, "DEV");
    chai.expect(url).equals("https://dev-connect-tilesdataaccess.bentley.com");

    TilesDataUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(TileDataAccessClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-connect-tilesdataaccess.bentley.com");

    TilesDataUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(TileDataAccessClient.searchKey, "PROD");
    chai.expect(url).equals("https://connect-tilesdataaccess.bentley.com");

    TilesDataUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(TileDataAccessClient.searchKey, "PERF");
    chai.expect(url).equals("https://perf-connect-tilesdataaccess.bentley.com");
  });

  it("should discover TilesGeneratorClient URLs correctly", async () => {
    TilesGeneratorUrlMock.mockGetUrl("DEV");
    let url = await urlDiscoveryClient.discoverUrl(TilesGeneratorClient.searchKey, "DEV");
    chai.expect(url).equals("https://dev-3dtilesgenerator.bentley.com");

    TilesGeneratorUrlMock.mockGetUrl("QA");
    url = await urlDiscoveryClient.discoverUrl(TilesGeneratorClient.searchKey, "QA");
    chai.expect(url).equals("https://qa-3dtilesgenerator.bentley.com");

    TilesGeneratorUrlMock.mockGetUrl("PROD");
    url = await urlDiscoveryClient.discoverUrl(TilesGeneratorClient.searchKey, "PROD");
    chai.expect(url).equals("https://3dtilesgenerator.bentley.com");

    TilesGeneratorUrlMock.mockGetUrl("PERF");
    url = await urlDiscoveryClient.discoverUrl(TilesGeneratorClient.searchKey, "PERF");
    chai.expect(url).equals("https://perf-3dtilesgenerator.bentley.com");
  });

});
