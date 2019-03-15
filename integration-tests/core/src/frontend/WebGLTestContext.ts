/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IAuthorizationClient } from "@bentley/imodeljs-clients";
import { IModelApp, NullRenderSystem } from "@bentley/imodeljs-frontend";
import { RenderSystem, RenderDiagnostics } from "@bentley/imodeljs-frontend/lib/rendering";

// Electron running inside a Windows VM fails to acquire a WebGLRenderingContext.
// This prevents us from creating a "real" RenderSystem during CI jobs.
// Use MaybeRenderApp in place of IModelApp in tests ONLY if the tests require a "real", WebGL-based RenderSystem.
// Tests which use MaybeRenderApp will NOT execute during Windows CI jobs.
// Prefer to use MockRender.App if the tests do not directly require/exercise the WebGL RenderSystem.
export class MaybeRenderApp extends IModelApp {
  protected static supplyRenderSystem(): RenderSystem {
    try {
      return super.supplyRenderSystem();
    } catch (e) {
      return new NullRenderSystem();
    }
  }
}

// See comments on MaybeRenderApp. In a nutshell: use this only if you are testing WebGL. Otherwise use MockRender.App.
export namespace WebGLTestContext {
  export let isInitialized = false;

  export function startup() {
    MaybeRenderApp.startup();
    isInitialized = MaybeRenderApp.hasRenderSystem;
    MaybeRenderApp.renderSystem.enableDiagnostics(RenderDiagnostics.All);
  }

  export function shutdown() {
    MaybeRenderApp.renderSystem.enableDiagnostics(RenderDiagnostics.None);
    MaybeRenderApp.shutdown();
    isInitialized = false;
  }

  export function setAuthorizationClient(authorizationClient: IAuthorizationClient) {
    MaybeRenderApp.authorizationClient = authorizationClient;
  }

  const canvasId = "WebGLTestCanvas";

  export function createCanvas(width: number = 300, height: number = 150): HTMLCanvasElement | undefined {
    let canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (null === canvas) {
      canvas = document.createElement("canvas") as HTMLCanvasElement;
      if (null === canvas) return undefined;

      canvas.id = canvasId;
      document.body.appendChild(document.createTextNode("WebGL tests"));
      document.body.appendChild(canvas);
    }

    canvas.width = width;
    canvas.height = height;

    return canvas;
  }
}
