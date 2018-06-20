/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@bentley/imodeljs-frontend";

(global as any).WebGLRenderingContext = require("gl"); // tslint:disable-line:no-var-requires
(global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // tslint:disable-line:no-var-requires

(IModelApp as any).supplyRenderSystem = () => ({
  onInitialized: () => {},
  onShutDown: () => {},
});
