/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
// common includes
import GatewayConfiguration from "../test-helpers/TestGatewayConfiguration";
// backend includes
import { IModelHost } from "@bentley/imodeljs-backend";
import { ECPresentation as ECPresentationBackend, ECPresentation } from "@bentley/ecpresentation-backend";
// frontend includes
import { StandaloneIModelGateway, IModelReadGateway } from "@bentley/imodeljs-common"; // doesn't really belong to "common"
import { IModelApp } from "@bentley/imodeljs-frontend";
import { ECPresentation as ECPresentationFrontend, ECPresentationGateway } from "@bentley/ecpresentation-frontend";

let isInitialized = false;

export const initialize = () => {
  if (isInitialized)
    return;

  // install mock of browser's XMLHttpRequest for unit tests
  (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // tslint:disable-line:no-var-requires

  // init backend
  IModelHost.startup();
  ECPresentationBackend.initialize({
    rulesetDirectories: [path.resolve(__dirname, "assets/rulesets/")],
  });

  // init frontend
  IModelApp.startup();
  ECPresentationFrontend.initialize();

  // set up gateways
  GatewayConfiguration.initialize([StandaloneIModelGateway, IModelReadGateway, ECPresentationGateway]);

  isInitialized = true;
};

export const terminate = () => {
  if (!isInitialized)
    return;

  // terminate backend
  ECPresentation.terminate();
  IModelHost.shutdown();

  // terminate frontend
  ECPresentation.terminate();
  IModelApp.shutdown();

  isInitialized = false;
};
