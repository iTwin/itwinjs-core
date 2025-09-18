/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Gradient, RenderTexture } from "@itwin/core-common";
import { _implementationProhibited, CustomGraphicBuilderOptions, GraphicBuilder, GraphicTemplate, RenderGraphic, RenderSystem, ViewportGraphicBuilderOptions } from "@itwin/core-frontend";

export class CesiumGraphicBuilder extends GraphicBuilder {
  public readonly [_implementationProhibited] = undefined;
  public readonly system: RenderSystem;

  public constructor(system: RenderSystem, options: ViewportGraphicBuilderOptions | CustomGraphicBuilderOptions) {
    super(options);
    this.system = system;
  }

  public override finish(): RenderGraphic {
    // ###TODO
    return this.system.createGraphicList([]);
  }

  public override finishTemplate(): GraphicTemplate {
    // ###TODO
    return { } as GraphicTemplate;
  }

  protected override resolveGradient(gradient: Gradient.Symb): RenderTexture | undefined {
    return this.system.getGradientTexture(gradient, this.iModel);
  }
}
