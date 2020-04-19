/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Capabilities } from "../Capabilities";
import { WebGLRenderCompatibilityStatus, WebGLFeature, queryRenderCompatibility } from "../RenderCompatibility";

let createContext = (canvas: HTMLCanvasElement, contextAttributes?: WebGLContextAttributes): WebGLRenderingContext | undefined => {
  let context = canvas.getContext("webgl", contextAttributes);
  if (null === context) {
    context = canvas.getContext("experimental-webgl", contextAttributes) as WebGLRenderingContext | null; // IE, Edge...
    if (null === context) {
      return undefined;
    }
  }
  return context;
};

function _createCanvas(): HTMLCanvasElement | undefined {
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  if (null === canvas)
    return undefined;
  return canvas;
}

class OverriddenFunctions {
  public origCreateContext = createContext;

  public overrideCreateContext(newGetParameter?: (ctx: WebGLRenderingContext | WebGL2RenderingContext, pname: number) => any, useContextAttributes: boolean = true) {
    createContext = (canvas, attr) => {
      const ctx = this.origCreateContext(canvas, useContextAttributes ? attr : undefined);
      if (undefined !== ctx && undefined !== newGetParameter) {
        const origGetParameter = ctx.getParameter;
        ctx.getParameter = (pname: number) => {
          const result = newGetParameter(ctx, pname);
          if (result !== undefined)
            return result;
          const boundGetParameter = origGetParameter.bind(ctx);
          return boundGetParameter(pname);
        };
      }
      return ctx;
    };
  }

  public restore() {
    createContext = this.origCreateContext;
  }
}

describe("Render Compatibility", () => {
  let overriddenFunctions: OverriddenFunctions;

  before(() => {
    overriddenFunctions = new OverriddenFunctions();
  });

  after(() => {
    overriddenFunctions.restore();
  });

  // NB: We assume software rendering for these tests because puppeteer only supports software rendering.
  // Further, we run in the context of Chrome, whose Swift software renderer fully supports our renderer.

  it("should query proper render compatibility info assuming software rendering causing performance caveat", () => {
    const compatibility = queryRenderCompatibility(createContext);
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.MajorPerformanceCaveat);
    expect(compatibility.contextErrorMessage).to.not.be.undefined;
  });

  it("should query proper render compatibility info assuming software rendering ignoring performance caveat", () => {
    overriddenFunctions.overrideCreateContext(undefined, false);
    const compatibility = queryRenderCompatibility(createContext);
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.MissingOptionalFeatures);
    expect(compatibility.missingRequiredFeatures.length).to.equal(0);
    expect(compatibility.missingOptionalFeatures.length).to.equal(1);
    expect(compatibility.missingOptionalFeatures[0]).to.equal("fragment depth");
    expect(compatibility.contextErrorMessage).to.be.undefined;
    overriddenFunctions.restore();
  });

  it("should query proper render compatibility info assuming not enough texture units", () => {
    overriddenFunctions.overrideCreateContext((ctx: WebGLRenderingContext | WebGL2RenderingContext, pname: number): any => {
      if (ctx.MAX_TEXTURE_IMAGE_UNITS === pname)
        return 0;
      return undefined;
    });

    const compatibility = queryRenderCompatibility(createContext);
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.MissingRequiredFeatures);
    expect(compatibility.missingRequiredFeatures.indexOf(WebGLFeature.MinimalTextureUnits)).to.not.equal(-1);
    overriddenFunctions.restore();
  });

  it("should query proper render compatibility info assuming lack of MRT support", () => {
    overriddenFunctions.overrideCreateContext((ctx: WebGLRenderingContext | WebGL2RenderingContext, pname: number): any => {
      const dbExt = ctx.getExtension("WEBGL_draw_buffers");
      if (null === dbExt)
        return undefined;
      if (dbExt.MAX_COLOR_ATTACHMENTS_WEBGL === pname)
        return 0;
      return undefined;
    }, false);

    const compatibility = queryRenderCompatibility(createContext);
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.MissingOptionalFeatures);
    expect(compatibility.missingOptionalFeatures.indexOf(WebGLFeature.MrtTransparency)).to.not.equal(-1);
    expect(compatibility.missingOptionalFeatures.indexOf(WebGLFeature.MrtPick)).to.not.equal(-1);
    overriddenFunctions.restore();
  });

  it("should query proper render compatibility info assuming lack of uint element index support", () => {
    const canvas = _createCanvas();
    expect(canvas).to.not.be.undefined;
    const context = createContext(canvas!);
    expect(context).to.not.be.undefined;

    const caps = new Capabilities();
    const compatibility = caps.init(context!, ["OES_element_index_uint"]);
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.MissingRequiredFeatures);
    expect(compatibility.missingRequiredFeatures.indexOf(WebGLFeature.UintElementIndex)).to.not.equal(-1);
  });

  it("should query proper render compatibility info assuming lack of depth texture support", () => {
    const canvas = _createCanvas();
    expect(canvas).to.not.be.undefined;
    const context = createContext(canvas!);
    expect(context).to.not.be.undefined;

    const caps = new Capabilities();
    const compatibility = caps.init(context!, ["WEBGL_depth_texture"]);
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.MissingOptionalFeatures);
    expect(compatibility.missingOptionalFeatures.indexOf(WebGLFeature.DepthTexture)).to.not.equal(-1);
  });

  it("should turn off logarithmicZBuffer if the gl frag depth extension is not available", () => {
    const canvas = _createCanvas();
    expect(canvas).to.not.be.undefined;
    const context = createContext(canvas!);
    expect(context).to.not.be.undefined;

    const caps = new Capabilities();
    const compatibility = caps.init(context!, ["EXT_frag_depth"]);
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.MissingOptionalFeatures);
    expect(compatibility.missingOptionalFeatures.indexOf(WebGLFeature.FragDepth)).to.not.equal(-1);
    expect(caps.supportsFragDepth).to.be.false;
  });

  it("should query proper render compatibility info assuming lack of instancing support", () => {
    const canvas = _createCanvas();
    expect(canvas).to.not.be.undefined;
    const context = createContext(canvas!);
    expect(context).to.not.be.undefined;

    const caps = new Capabilities();
    const compatibility = caps.init(context!, ["ANGLE_instanced_arrays"]);
    expect(compatibility.status).to.equal(WebGLRenderCompatibilityStatus.MissingOptionalFeatures);
    expect(compatibility.missingOptionalFeatures.indexOf(WebGLFeature.Instancing)).to.not.equal(-1);
  });
});
