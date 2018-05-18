/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// a hack to get imodeljs-frontend import working
(global as any).WebGLRenderingContext = require("gl"); // tslint:disable-line:no-var-requires
// common includes
import TestRpcManager from "@helpers/TestRpcManager";
// backend includes
import { IModelHost } from "@bentley/imodeljs-backend";
import { ECPresentation as ECPresentationBackend, ECPresentation } from "@bentley/ecpresentation-backend";
// frontend includes
import { StandaloneIModelRpcInterface, IModelReadRpcInterface } from "@bentley/imodeljs-common";
import { ECPresentationRpcInterface } from "@bentley/ecpresentation-common";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { ECPresentation as ECPresentationFrontend } from "@bentley/ecpresentation-frontend";

process.env.NODE_ENV = "development";
let isInitialized = false;

export const initialize = () => {
  if (isInitialized)
    return;

  // install mock of browser's XMLHttpRequest for unit tests
  (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // tslint:disable-line:no-var-requires

  // init backend
  IModelHost.startup();
  ECPresentationBackend.initialize({
    rulesetDirectories: ["assets/rulesets"],
    localeDirectories: ["assets/locales"],
  });

  // set up rpc interfaces
  TestRpcManager.initializeClient([StandaloneIModelRpcInterface, IModelReadRpcInterface, ECPresentationRpcInterface]);

  // init frontend
  IModelApp.startup();
  ECPresentationFrontend.initialize({
    activeLocale: IModelApp.i18n.languageList()[0],
  });

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
