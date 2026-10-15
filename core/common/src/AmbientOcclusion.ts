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
    /** If defined, represents an angle in radians. If the dot product between the normal of the sample and the vector to the camera is less than this value, sampling stops in the current direction. This is used to remove shadows from near planar edges. If undefined, the bias defaults to 0.25. */
    readonly bias?: number;
    /** If defined, if the distance in linear depth from the current sample to first sample is greater than this value, sampling stops in the current direction. If undefined, the zLengthCap defaults to 0.0025.  The full range of linear depth is 0 to 1. */
    readonly zLengthCap?: number;
    /** If defined, the maximum distance from the camera's near plane in meters at which ambient occlusion will be applied. If undefined, the maximum distance defaults to 10000. */
    readonly maxDistance?: number;
    /** If defined, raise the final ambient occlusion to the power of this value. Larger values make the ambient shadows darker. If undefined, the intensity defaults to 2.0. */
    readonly intensity?: number;
    /** If defined, indicates the texel distance to step toward the next texel sample in the current direction. For portions of geometry close to the near plane, this value will be what is used. As portions of geometry extend away from the near plane, this value will gradually reduce until it reaches a minimum value of 1.0 at the far plane. If undefined, texelStepSize defaults to 1.95. */
    readonly texelStepSize?: number;
    /** If defined, blurDelta is used to compute the weight of a Gaussian filter. The equation is exp((-0.5 * blurDelta * blurDelta) / (blurSigma * blurSigma)). If undefined, blurDelta defaults to 1.0. */
    readonly blurDelta?: number;
    /** If defined, blurSigma is used to compute the weight of a Gaussian filter. The equation is exp((-0.5 * blurDelta * blurDelta) / (blurSigma * blurSigma)). If undefined, blurSigma defaults to 2.0. */
    readonly blurSigma?: number;
    /* If defined, blurTexelStepSize indicates the distance to the next texel for blurring. If undefined, blurTexelStepSize defaults to 1.0. */
    readonly blurTexelStepSize?: number;
  }

  /** Describes the properties with which ambient occlusion should be drawn. These properties correspond to a horizon-based ambient occlusion approach. */
  export class Settings implements Props {
    private static _defaultBias: number = 0.5;
    private static _defaultZLengthCap: number = 0.00007;
    private static _defaultMaxDistance: number = 10000.0;
    private static _defaultIntensity: number = 1.0;
    private static _defaultTexelStepSize: number = 1;
    private static _defaultBlurDelta: number = 1.0;
    private static _defaultBlurSigma: number = 2.0;
    private static _defaultBlurTexelStepSize: number = 1.0;

    public readonly bias: number;
    public readonly zLengthCap: number;
    public readonly maxDistance: number;
    public readonly intensity: number;
    public readonly texelStepSize: number;
    public readonly blurDelta: number;
    public readonly blurSigma: number;
    public readonly blurTexelStepSize: number;

    private constructor(json?: Props) {
      if (undefined === json)
        json = {};

      this.bias = JsonUtils.asDouble(json.bias, Settings._defaultBias);
      this.zLengthCap = JsonUtils.asDouble(json.zLengthCap, Settings._defaultZLengthCap);
      this.maxDistance = JsonUtils.asDouble(json.maxDistance, Settings._defaultMaxDistance);
      this.intensity = JsonUtils.asDouble(json.intensity, Settings._defaultIntensity);
      this.texelStepSize = JsonUtils.asDouble(json.texelStepSize, Settings._defaultTexelStepSize);
      this.blurDelta = JsonUtils.asDouble(json.blurDelta, Settings._defaultBlurDelta);
      this.blurSigma = JsonUtils.asDouble(json.blurSigma, Settings._defaultBlurSigma);
      this.blurTexelStepSize = JsonUtils.asDouble(json.blurTexelStepSize, Settings._defaultBlurTexelStepSize);
    }

    public static defaults = new Settings({});

    public static fromJSON(json?: Props): Settings { return undefined !== json ? new Settings(json) : this.defaults; }

    public toJSON(): Props {
      return {
        bias: this.bias !== Settings._defaultBias ? this.bias : undefined,
        zLengthCap: this.zLengthCap !== Settings._defaultZLengthCap ? this.zLengthCap : undefined,
        maxDistance: this.maxDistance !== Settings._defaultMaxDistance ? this.maxDistance : undefined,
        intensity: this.intensity !== Settings._defaultIntensity ? this.intensity : undefined,
        texelStepSize: this.texelStepSize !== Settings._defaultTexelStepSize ? this.texelStepSize : undefined,
        blurDelta: this.blurDelta !== Settings._defaultBlurDelta ? this.blurDelta : undefined,
        blurSigma: this.blurSigma !== Settings._defaultBlurSigma ? this.blurSigma : undefined,
        blurTexelStepSize: this.blurTexelStepSize !== Settings._defaultBlurTexelStepSize ? this.blurTexelStepSize : undefined,
      };
    }
  }
}
