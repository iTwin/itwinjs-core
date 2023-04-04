/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */
import { JsonUtils } from "@itwin/core-bentley";

/** Namespace containing types controlling how atmospheric scattering should be rendered.
 * @public
 * The techniques used to render the atmosphere approximate the physical behavior of light when interacting with particles in the air (Rayleigh Scattering and Mie Scattering)
 * Presently, only Rayleigh Scattering is implemented here
 *
 * In a nutshell, this implementation samples atmospheric density along rays cast from the view and uses the samples to simulate the scattering of light toward the camera.
 * The amount of light scattered toward the camera is dependent on the amount of light scattered away from its original path from the sun, so rays must also be cast from the sample points to the sun.
 *
 * The effect can be computed on vertices (the default for the background map) and fragments (the default for the skybox, which is a ViewportQuad).
 * All coordinates are in view space.
 *
 * This implementation is adapted from equations outlined in "Display of Clouds Taking into Account Multiple Anisotropic Scattering and Sky Light", Nishita et al. 1993
 *   which are further refined for use in GPU shaders in "Photorealistic Real-Time Outdoor Light Scattering", Hoffman and Preetham 2002.
 * These sources are also compiled in Chapter 16 of NVIDIA's "GPU Gems 2", which can be found online here:
 *   https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering
 *
 * This implementation is also highly inspired by Sebastian Lague's Solar System project: https://github.com/SebLague/Solar-System/ and video: https://www.youtube.com/watch?v=DxfEbulyFcY
 *   along with this ShaderToy replica: https://www.shadertoy.com/view/fltXD2.
 * Both of which are inspired by this Nvidia article on atmospheric scattering: https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering.
 */
export namespace Atmosphere {

  /** JSON representation of a [[Wavelengths]] object */
  export interface WavelengthsProps {
    r: number;
    g: number;
    b: number;
  }

  /** An immutable container of wavelength values for the red, green and blue pixel components. Values are in nanometers. */
  export class Wavelengths {
    public readonly r: number;
    public readonly g: number;
    public readonly b: number;

    /** Constructs from red, green, and blue wavelength values.
     * @param r Wavelength value for red
     * @param g Wavelength value for green
     * @param b Wavelength value for blue
     */
    constructor(props: WavelengthsProps) {
      this.r = Math.max(0, props.r);
      this.g = Math.max(0, props.g);
      this.b = Math.max(0, props.b);
    }

    public equals(other: Wavelengths): boolean {
      return this.r === other.r && this.g === other.g && this.b === other.b;
    }

    public toJSON(): WavelengthsProps {
      return { r: this.r, g: this.g, b: this.b };
    }

    public static fromJSON(json: WavelengthsProps | undefined): Wavelengths {
      let r = 0;
      let g = 0;
      let b = 0;
      if (undefined !== json) {
        if (typeof json.r === "number")
          r = json.r;
        if (typeof json.g === "number")
          g = json.g;
        if (typeof json.b === "number")
          b = json.b;
      }
      return new Wavelengths({ r, g, b });
    }
  }

  /** Describes the properties with which the atmospheric scattering effect should be drawn. Theses properties correspond to a physics-based approximation of atmospheric scattering phenomenons. */
  export interface Props {
    /** Whether the ground plane should be displayed. Defaults to false. */
    display?: boolean;
    /** See [[Settings.atmosphereHeightAboveEarth]] */
    atmosphereHeightAboveEarth?: number;
    /** See [[Settings.exposure]] */
    exposure?: number;
    /** See [[Settings.densityFalloff]] */
    densityFalloff?: number;
    /** See [[Settings.minDensityHeightBelowEarth]] */
    depthBelowEarthForMaxDensity?: number;
    /** See [[Settings.numViewRaySamples]] */
    numViewRaySamples?: number;
    /** See [[Settings.numSunRaySamples]] */
    numSunRaySamples?: number;
    /** See [[Settings.outScatteringIntensity]] */
    outScatteringIntensity?: number;
    /** See [[Settings.scatteringStrength]] */
    scatteringStrength?: number;
    /** See [[Settings.wavelengths]] */
    wavelengths?: WavelengthsProps;
  }

  /** Describes the properties with which the atmospheric scattering effect should be drawn. Theses properties correspond to a physics-based approximation of atmospheric scattering phenomenons. */
  export class Settings {
    private static _defaultAtmosphereHeightAboveEarth: number = 100000.0;
    private static _defaultExposure: number = 2.5;
    private static _defaultDensityFalloff: number = 10.0;
    private static _defaultMinDensityHeightBelowEarth: 0.0;
    private static _defaultOutScatteringIntensity: number = 1.0;
    private static _defaultScatteringStrength: number = 5;
    private static _defaultWavelengths: Wavelengths = new Wavelengths({ r: 700.0, g: 530.0, b: 440.0 });

    private static _defaultNumViewRaySamples: number = 10;
    private static _highQualityNumViewRaySamples: number = 20;
    private static _defaultNumSunRaySamples: number = 5;

    public static readonly defaults = new Settings({});
    public static readonly highQuality = new Settings({ numViewRaySamples: this._highQualityNumViewRaySamples });

    /** If defined, corresponds to the height in meters above the earth's pole at which the atmosphere terminates. Physically, this is the point at which there are no more air molecules to interfere with light transmission. Defaults to 100_000.0. */
    public readonly atmosphereHeightAboveEarth: number;
    /** If defined, this value is used to simulate the aperture of a camera. Higher values allow more light in. Defaults to 2.5 */
    public readonly exposure: number;
    /** If defined, controls the rate at which the air density decreases between the point it is the highest and the point is is the lowest. A higher value means a faster decrease in air density. Defaults to 10.0. */
    public readonly densityFalloff: number;
    /** If defined, corresponds to the height in meters below the earth's pole at which the atmosphere is at its densest. Physically, this is the point at which there is the most air molecules to interfere with light transmission. Defaults to 0.0. */
    public readonly depthBelowEarthForMaxDensity: number;
    /** If defined, corresponds to the number of atmospheric density samples used to compute the amount of light scattered along each view ray. For each sample point, another ray will be cast toward the sun to compute the amount of light reaching the sample point. Higher values increase fidelity, but greatly decrease performance because sun rays must be cast from each additional sample point. The range is 1 to 40. Defaults to 10. */
    public readonly numViewRaySamples: number;
    /** If defined, corresponds to the number of atmospheric density samples uses to compute the amount of light scattered along each sun ray. Higher values increase fidelity slightly but greatly decreases performance. Minimal improvement is observable with values above 5. The range is 1 to 40. Defaults to 5. */
    public readonly numSunRaySamples: number;
    /** If defined, multiplies the amount of light scattered away from the viewing eye by this value. Higher values result in less light being transmitted to the camera. Defaults to 1.0. */
    public readonly outScatteringIntensity: number;
    /** If defined, controls how strongly the atmosphere's air diverts light. Defaults to 5.0.  */
    public readonly scatteringStrength: number;
    /** If defined, corresponds the wavelengths of the red, green and blue color components in nanometers used to simulate how the atmosphere's air molecules affects light transmission. (See Rayleigh Scattering) Thus, a value of 470 for the red wavelength will make the red light component scatter as if it physically were a cyan light ray. The default value is {r:700.0, g:530.0, b:440.0}. */
    public readonly wavelengths: Wavelengths;

    public equals(other: Settings): boolean {
      if (this.atmosphereHeightAboveEarth !== other.atmosphereHeightAboveEarth)
        return false;
      if (this.exposure !== other.exposure)
        return false;
      if (this.densityFalloff !== other.densityFalloff)
        return false;
      if (this.depthBelowEarthForMaxDensity !== other.depthBelowEarthForMaxDensity)
        return false;
      if (this.numViewRaySamples !== other.numViewRaySamples)
        return false;
      if (this.numSunRaySamples !== other.numSunRaySamples)
        return false;
      if (this.outScatteringIntensity !== other.outScatteringIntensity)
        return false;
      if (this.scatteringStrength !== other.scatteringStrength)
        return false;
      if (!this.wavelengths.equals(other.wavelengths))
        return false;
      return true;
    }

    private constructor(json: Props) {
      this.atmosphereHeightAboveEarth = JsonUtils.asDouble(json.atmosphereHeightAboveEarth, Settings._defaultAtmosphereHeightAboveEarth);
      this.exposure = JsonUtils.asDouble(json.exposure, Settings._defaultExposure);
      this.densityFalloff = JsonUtils.asDouble(json.densityFalloff, Settings._defaultDensityFalloff);
      this.depthBelowEarthForMaxDensity = JsonUtils.asDouble(json.depthBelowEarthForMaxDensity, Settings._defaultMinDensityHeightBelowEarth);
      this.numViewRaySamples = JsonUtils.asDouble(json.numViewRaySamples, Settings._defaultNumViewRaySamples);
      this.numSunRaySamples = JsonUtils.asDouble(json.numSunRaySamples, Settings._defaultNumSunRaySamples);
      this.outScatteringIntensity = JsonUtils.asDouble(json.outScatteringIntensity, Settings._defaultOutScatteringIntensity);
      this.scatteringStrength = JsonUtils.asDouble(json.scatteringStrength, Settings._defaultScatteringStrength);
      this.wavelengths = Wavelengths.fromJSON(JsonUtils.asObject(json.wavelengths) ?? Settings._defaultWavelengths);
    }

    public static fromJSON(json?: Props) {
      if (undefined === json)
        return this.defaults;
      return new Settings(json);
    }

    public toJSON(display?: boolean): Props {
      const json: Props = {
        atmosphereHeightAboveEarth: this.atmosphereHeightAboveEarth,
        exposure: this.exposure,
        densityFalloff: this.densityFalloff,
        depthBelowEarthForMaxDensity: this.depthBelowEarthForMaxDensity,
        numViewRaySamples: this.numViewRaySamples,
        numSunRaySamples: this.numSunRaySamples,
        outScatteringIntensity: this.outScatteringIntensity,
        scatteringStrength: this.scatteringStrength,
        wavelengths: this.wavelengths.toJSON(),
      };

      if (undefined !== display)
        json.display = display;

      return json;
    }
  }
}
