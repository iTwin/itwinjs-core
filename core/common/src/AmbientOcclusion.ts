/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { JsonUtils } from "@itwin/core-bentley";

/** Namespace containing types controlling how ambient occlusion should be drawn.
 * @public
 */
export namespace AmbientOcclusion {
  /** Describes the properties with which ambient occlusion should be drawn. These properties correspond to a horizon-based ambient occlusion approach. */
  export interface Props {
    /** Represents the angle offset used in the AO calculation. Default value is 0.0 */
    readonly angleOffset?: number;
    /** Represents the spatial offset used in the AO calculation. Default value is 0.0 */
    readonly spacialOffset?: number;
    /** Represents the calculated horizon 1 for the AO integration. Default value is -1.0 */
    readonly c1?: number;
    /** Represents the calculated horizon 2 for the AO integration. Default value is -1.0 */
    readonly c2?: number;
    /** Represents the SSAO sample limit, default is 100 */
    readonly ssaoLimit?: number;
    /** Represents the number of SSAO samples, default is 4 */
    readonly ssaoSamples?: number;
    /** Represents the SSAO radius, default is 2.5 */
    readonly ssaoRadius?: number;
    /** Represents the SSAO falloff, default is 1.5 */
    readonly ssaoFalloff?: number;
    /** Represents the SSAO thickness mix, default is 0.2 */
    readonly ssaoThicknessMix?: number;
    /** Represents the SSAO max stride, default is 32 */
    readonly ssaoMaxStride?: number;
    /** If defined, the maximum distance from the camera's near plane in meters at which ambient occlusion will be applied. If undefined, the maximum distance defaults to 10000. */
    readonly maxDistance?: number;
    /** If defined, blurDelta is used to compute the weight of a Gaussian filter. The equation is exp((-0.5 * blurDelta * blurDelta) / (blurSigma * blurSigma)). If undefined, blurDelta defaults to 1.0. */
    readonly blurDelta?: number;
    /** If defined, blurSigma is used to compute the weight of a Gaussian filter. The equation is exp((-0.5 * blurDelta * blurDelta) / (blurSigma * blurSigma)). If undefined, blurSigma defaults to 2.0. */
    readonly blurSigma?: number;
    /* If defined, blurTexelStepSize indicates the distance to the next texel for blurring. If undefined, blurTexelStepSize defaults to 1.0. */
    readonly blurTexelStepSize?: number;
  }

  /** Describes the properties with which ambient occlusion should be drawn. These properties correspond to a horizon-based ambient occlusion approach. */
  export class Settings implements Props {
    private static _defaultAngleOffset: number = 0.0;
    private static _defaultSpacialOffset: number = 0.0;
    private static _defaultC1: number = -1.0;
    private static _defaultC2: number = -1.0;
    private static _defaultSSAOLimit: number = 100;
    private static _defaultSSAOSamples: number = 4;
    private static _defaultSSAORadius: number = 2.5;
    private static _defaultSSAOFalloff: number = 1.5;
    private static _defaultSSAOMix: number = 0.2;
    private static _defaultSSAOStride: number = 1;
    private static _defaultMaxDistance: number = 10000.0;
    private static _defaultBlurDelta: number = 1.0;
    private static _defaultBlurSigma: number = 2.0;
    private static _defaultBlurTexelStepSize: number = 1.0;

    public readonly angleOffset: number;
    public readonly spacialOffset: number;
    public readonly c1: number;
    public readonly c2: number;
    public readonly ssaoLimit: number;
    public readonly ssaoSamples: number;
    public readonly ssaoRadius: number;
    public readonly ssaoFalloff: number;
    public readonly ssaoThicknessMix: number;
    public readonly ssaoMaxStride: number;
    public readonly maxDistance: number;
    public readonly blurDelta: number;
    public readonly blurSigma: number;
    public readonly blurTexelStepSize: number;

    private constructor(json?: Props) {
      if (undefined === json)
        json = {};
      this.angleOffset = JsonUtils.asDouble(json.angleOffset, Settings._defaultAngleOffset);
      this.spacialOffset = JsonUtils.asDouble(json.spacialOffset, Settings._defaultSpacialOffset);
      this.c1 = JsonUtils.asDouble(json.c1, Settings._defaultC1);
      this.c2 = JsonUtils.asDouble(json.c2, Settings._defaultC2);
      this.ssaoLimit = JsonUtils.asInt(json.ssaoLimit, Settings._defaultSSAOLimit);
      this.ssaoSamples = JsonUtils.asInt(json.ssaoSamples, Settings._defaultSSAOSamples);
      this.ssaoRadius = JsonUtils.asDouble(json.ssaoRadius, Settings._defaultSSAORadius);
      this.ssaoFalloff = JsonUtils.asDouble(json.ssaoFalloff, Settings._defaultSSAOFalloff);
      this.ssaoThicknessMix = JsonUtils.asDouble(json.ssaoThicknessMix, Settings._defaultSSAOMix);
      this.ssaoMaxStride = JsonUtils.asInt(json.ssaoMaxStride, Settings._defaultSSAOStride);
      this.maxDistance = JsonUtils.asDouble(json.maxDistance, Settings._defaultMaxDistance);
      this.blurDelta = JsonUtils.asDouble(json.blurDelta, Settings._defaultBlurDelta);
      this.blurSigma = JsonUtils.asDouble(json.blurSigma, Settings._defaultBlurSigma);
      this.blurTexelStepSize = JsonUtils.asDouble(json.blurTexelStepSize, Settings._defaultBlurTexelStepSize);
    }

    public static defaults = new Settings({});

    public static fromJSON(json?: Props): Settings { return undefined !== json ? new Settings(json) : this.defaults; }

    public toJSON(): Props {
      return {
        angleOffset: this.angleOffset !== Settings._defaultAngleOffset ? this.angleOffset : undefined,
        spacialOffset: this.spacialOffset !== Settings._defaultSpacialOffset ? this.spacialOffset : undefined,
        c1: this.c1 !== Settings._defaultC1 ? this.c1 : undefined,
        c2: this.c2 !== Settings._defaultC2 ? this.c2 : undefined,
        ssaoLimit: this.ssaoLimit !== Settings._defaultSSAOLimit ? this.ssaoLimit : undefined,
        ssaoSamples: this.ssaoSamples !== Settings._defaultSSAOSamples ? this.ssaoSamples : undefined,
        ssaoRadius: this.ssaoRadius !== Settings._defaultSSAORadius ? this.ssaoRadius : undefined,
        ssaoFalloff: this.ssaoFalloff !== Settings._defaultSSAOFalloff ? this.ssaoFalloff : undefined,
        ssaoThicknessMix: this.ssaoThicknessMix !== Settings._defaultSSAOMix ? this.ssaoThicknessMix : undefined,
        ssaoMaxStride: this.ssaoMaxStride !== Settings._defaultSSAOStride ? this.ssaoMaxStride : undefined,
        maxDistance: this.maxDistance !== Settings._defaultMaxDistance ? this.maxDistance : undefined,
        blurDelta: this.blurDelta !== Settings._defaultBlurDelta ? this.blurDelta : undefined,
        blurSigma: this.blurSigma !== Settings._defaultBlurSigma ? this.blurSigma : undefined,
        blurTexelStepSize: this.blurTexelStepSize !== Settings._defaultBlurTexelStepSize ? this.blurTexelStepSize : undefined,
      };
    }
  }
}
