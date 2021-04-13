/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

// cspell:ignore ovrs

import { JsonUtils } from "@bentley/bentleyjs-core";

/** Enumerates the available rendering modes. The rendering mode chiefly controls whether and how surfaces and their edges are drawn.
 * Generally speaking,
 *  - Wireframe draws only edges.
 *  - SmoothShade draws only surfaces.
 *  - HiddenLine and SolidFill draw both surfaces and edges.
 *  - Lighting is only applied in SmoothShade mode.
 *
 * The [[FillFlags]] associated with planar regions controls whether and how the region's interior area is displayed in Wireframe mode.
 * [[ViewFlags]] has options for enabling display of visible and/or hidden edges in SmoothShade mode.
 * [[HiddenLine.Settings]] allow aspects of edge and surface symbology to be overridden within a view.
 * @public
 */
export enum RenderMode {
  /** Render only edges, no surfaces, with exceptions for planar regions with [[FillFlags]] set up to render the surface in wireframe mode. */
  Wireframe = 0,
  /** Render only surfaces, no edges, with lighting. */
  SmoothShade = 6,
  /** Render edges and surfaces. Surfaces are drawn using the view's background color instead of the element's fill color. */
  HiddenLine = 3,
  /** Render edges and surfaces. */
  SolidFill = 4,
}

/** JSON representation of [[ViewFlags]]
 * @public
 */
export interface ViewFlagProps {
  /** If true, don't show construction class. */
  noConstruct?: boolean;
  /** If true, don't show dimension class. */
  noDim?: boolean;
  /** If true, don't show patterns. */
  noPattern?: boolean;
  /** If true, don't line weights. */
  noWeight?: boolean;
  /** If true, don't line styles. */
  noStyle?: boolean;
  /** If true, don't use transparency. */
  noTransp?: boolean;
  /** If true, don't show filled regions. */
  noFill?: boolean;
  /** If true, show grids. */
  grid?: boolean;
  /** If true, show AuxCoordSystem. */
  acs?: boolean;
  /** If true, don't show textures. */
  noTexture?: boolean;
  /** If true, don't show materials. */
  noMaterial?: boolean;
  /** If true, don't use camera lights.
   * @note Currently the renderer only supports solar lighting. For backwards-compatibility reasons, solar lights will be displayed if any combination of [[noCameraLights]], [[noSourceLights]], or [[noSolarLight]] is set to `false`.
   */
  noCameraLights?: boolean;
  /** If true, don't use source lights.
   * @note Currently the renderer only supports solar lighting. For backwards-compatibility reasons, solar lights will be displayed if any combination of [[noCameraLights]], [[noSourceLights]], or [[noSolarLight]] is set to `false`.
   */
  noSourceLights?: boolean;
  /** If true, don't use solar lights.
   * @note Currently the renderer only supports solar lighting. For backwards-compatibility reasons, solar lights will be displayed if any combination of [[noCameraLights]], [[noSourceLights]], or [[noSolarLight]] is set to `false`.
   */
  noSolarLight?: boolean;
  /** If true, show visible edges. */
  visEdges?: boolean;
  /** If true, show hidden edges. */
  hidEdges?: boolean;
  /** If true, show shadows. */
  shadows?: boolean;
  /** If true, use the view's clipping volume. Has no effect on other types of clips like [[ModelClipGroups]]. */
  clipVol?: boolean;
  /** If true, use hidden line material colors. */
  hlMatColors?: boolean;
  /** If true, show view with monochrome settings. */
  monochrome?: boolean;
  /** @internal unused */
  edgeMask?: number;
  /** [[RenderMode]] */
  renderMode?: number;
  /** Display background map. */
  backgroundMap?: boolean;
  /** If true, show ambient occlusion. */
  ambientOcclusion?: boolean;
  /** If true, show thematic display.
   * @note Currently, thematically displayed geometry will not receive shadows. If thematic display is enabled, shadows will not be received by thematically displayed geometry, even if shadows are enabled.
   */
  thematicDisplay?: boolean;
  /** Controls whether surface discard is always applied regardless of other ViewFlags.
   * Surface shaders contain complicated logic to ensure that the edges of a surface always draw in front of the surface, and that planar surfaces sketched coincident with
   * non-planar surfaces always draw in front of those non-planar surfaces.
   * When this view flag is set to false (the default), then for 3d views if the render mode is wireframe (only edges are displayed) or smooth shader with visible edges turned off (only surfaces are displayed),
   * that logic does not execute, potentially improving performance for no degradation in visual quality. In some scenarios - such as wireframe views containing many planar regions with interior fill, or smooth views containing many coincident planar and non-planar surfaces - enabling this view flag improves display quality by forcing that logic to execute.
   */
  forceSurfaceDiscard?: boolean;
  /** Disables the "white-on-white reversal" employed by some CAD applications. White-on-white reversal causes white geometry to be drawn as black if the view's background color is also white. */
  noWhiteOnWhiteReversal?: boolean;
}

function edgesRequired(renderMode: RenderMode, visibleEdges: boolean): boolean {
  return visibleEdges || RenderMode.SmoothShade !== renderMode;
}

/** Flags for controlling how graphics appear within a View.
 * @public
 */
export class ViewFlags {
  /** The [[RenderMode]] of the view. */
  public renderMode: RenderMode = RenderMode.Wireframe;
  /** Shows or hides dimensions. */
  public dimensions: boolean = true;
  /** Shows or hides pattern geometry. */
  public patterns: boolean = true;
  /** Controls whether non-zero line weights are used or display using weight 0. */
  public weights: boolean = true;
  /** Controls whether custom line styles are used (e.g. control whether elements with custom line styles draw normally, or as solid lines). */
  public styles: boolean = true;
  /** Controls whether element transparency is used (e.g. control whether elements with transparency draw normally, or as opaque). */
  public transparency: boolean = true;
  /** Controls whether the fills on filled elements are displayed. */
  public fill: boolean = true;
  /** Controls whether to display texture maps for material assignments. When off only material color is used for display. */
  public textures: boolean = true;
  /** Controls whether materials are used (e.g. control whether geometry with materials draw normally, or as if it has no material). */
  public materials: boolean = true;
  /** Shows or hides the ACS triad. */
  public acsTriad: boolean = false;
  /** Shows or hides the grid. The grid settings are a design file setting. */
  public grid: boolean = false;
  /** Shows or hides visible edges in the shaded render mode. */
  public visibleEdges: boolean = false;
  /** Shows or hides hidden edges in the shaded render mode. */
  public hiddenEdges: boolean = false;
  /** Controls whether the source lights in spatial models are used
   * @note Currently the renderer only supports solar lighting. For backwards-compatibility reasons, solar lights will be displayed if any combination of [[noCameraLights]], [[noSourceLights]], or [[noSolarLight]] is set to `false`.
   * @see [[lighting]] for a more convenient way to toggle lighting on and off.
   */
  public sourceLights: boolean = false;
  /** Controls whether camera (ambient, portrait, flashbulb) lights are used.
   * @note Currently the renderer only supports solar lighting. For backwards-compatibility reasons, solar lights will be displayed if any combination of [[noCameraLights]], [[noSourceLights]], or [[noSolarLight]] is set to `false`.
   * @see [[lighting]] for a more convenient way to toggle lighting on and off.
   */
  public cameraLights: boolean = false;
  /** Controls whether sunlight used
   * @note Currently the renderer only supports solar lighting. For backwards-compatibility reasons, solar lights will be displayed if any combination of [[noCameraLights]], [[noSourceLights]], or [[noSolarLight]] is set to `false`.
   * @see [[lighting]] for a more convenient way to toggle lighting on and off.
   */
  public solarLight: boolean = false;
  /** Shows or hides shadows. */
  public shadows: boolean = false;
  /** Controls whether the view's clip volume is applied. Has no effect on other types of clips like [[ModelClipGroups]]. */
  public clipVolume: boolean = true;
  /** Shows or hides construction class geometry. */
  public constructions: boolean = false;
  /** Draw geometry using the view's monochrome color.
   * @see [DisplayStyleSettings.monochromeColor]($common) for details on how the color is applied.
   * @see [DisplayStyleSettings.monochromeMode]($common) to control the type of monochrome display applied.
   */
  public monochrome: boolean = false;
  /** @internal unused Ignore geometry maps */
  public noGeometryMap: boolean = false;
  /** Display background map */
  public backgroundMap: boolean = false;
  /** Use material colors for hidden lines */
  public hLineMaterialColors: boolean = false;
  /** @internal 0=none, 1=generate mask, 2=use mask */
  public edgeMask: number = 0;
  /** Controls whether ambient occlusion is used. */
  public ambientOcclusion: boolean = false;
  /** Controls whether thematic display is used.
   * @note Currently, thematically displayed geometry will not receive shadows. If thematic display is enabled, shadows will not be received by thematically displayed geometry, even if shadows are enabled.
   */
  public thematicDisplay: boolean = false;
  /** Controls whether surface discard is always applied regardless of other ViewFlags.
   * Surface shaders contain complicated logic to ensure that the edges of a surface always draw in front of the surface, and that planar surfaces sketched coincident with
   * non-planar surfaces always draw in front of those non-planar surfaces.
   * When this view flag is set to false (the default), then for 3d views if the render mode is wireframe (only edges are displayed) or smooth shader with visible edges turned off (only surfaces are displayed),
   * that logic does not execute, potentially improving performance for no degradation in visual quality. In some scenarios - such as wireframe views containing many planar regions with interior fill, or smooth views containing many coincident planar and non-planar surfaces - enabling this view flag improves display quality by forcing that logic to execute.
   */
  public forceSurfaceDiscard: boolean = false;
  /** White-on-white reversal is used by some CAD applications to cause white geometry to be drawn as black if the view's background color is also white. */
  public whiteOnWhiteReversal = true;

  /** Controls whether or not lighting is applied.
   * @note Has no effect unless `renderMode` is set to [[RenderMode.SmoothShade]].
   */
  public get lighting(): boolean { return this.solarLight || this.sourceLights || this.cameraLights; }
  public set lighting(enable: boolean) { this.solarLight = this.sourceLights = this.cameraLights = enable; }

  public clone(out?: ViewFlags): ViewFlags { return ViewFlags.createFrom(this, out); }
  public static createFrom(other?: ViewFlags, out?: ViewFlags): ViewFlags {
    const val = undefined !== out ? out : new ViewFlags();
    if (other) {
      val.renderMode = other.renderMode;
      val.dimensions = other.dimensions;
      val.patterns = other.patterns;
      val.weights = other.weights;
      val.styles = other.styles;
      val.transparency = other.transparency;
      val.fill = other.fill;
      val.textures = other.textures;
      val.materials = other.materials;
      val.acsTriad = other.acsTriad;
      val.grid = other.grid;
      val.visibleEdges = other.visibleEdges;
      val.hiddenEdges = other.hiddenEdges;
      val.sourceLights = other.sourceLights;
      val.cameraLights = other.cameraLights;
      val.solarLight = other.solarLight;
      val.shadows = other.shadows;
      val.clipVolume = other.clipVolume;
      val.constructions = other.constructions;
      val.monochrome = other.monochrome;
      val.noGeometryMap = other.noGeometryMap;
      val.hLineMaterialColors = other.hLineMaterialColors;
      val.backgroundMap = other.backgroundMap;
      val.edgeMask = other.edgeMask;
      val.ambientOcclusion = other.ambientOcclusion;
      val.thematicDisplay = other.thematicDisplay;
      val.forceSurfaceDiscard = other.forceSurfaceDiscard;
      val.whiteOnWhiteReversal = other.whiteOnWhiteReversal;
    }

    return val;
  }

  /** @internal */
  public hiddenEdgesVisible(): boolean {
    switch (this.renderMode) {
      case RenderMode.SolidFill:
      case RenderMode.HiddenLine:
        return this.hiddenEdges;
      case RenderMode.SmoothShade:
        return this.visibleEdges && this.hiddenEdges;
    }
    return true;
  }
  /** @internal */
  public edgesRequired(): boolean {
    return edgesRequired(this.renderMode, this.visibleEdges);
  }

  public toJSON(): ViewFlagProps {
    const out: ViewFlagProps = {};
    if (!this.constructions) out.noConstruct = true;
    if (!this.dimensions) out.noDim = true;
    if (!this.patterns) out.noPattern = true;
    if (!this.weights) out.noWeight = true;
    if (!this.styles) out.noStyle = true;
    if (!this.transparency) out.noTransp = true;
    if (!this.fill) out.noFill = true;
    if (this.grid) out.grid = true;
    if (this.acsTriad) out.acs = true;
    if (!this.textures) out.noTexture = true;
    if (!this.materials) out.noMaterial = true;
    if (!this.cameraLights) out.noCameraLights = true;
    if (!this.sourceLights) out.noSourceLights = true;
    if (!this.solarLight) out.noSolarLight = true;
    if (this.visibleEdges) out.visEdges = true;
    if (this.hiddenEdges) out.hidEdges = true;
    if (this.shadows) out.shadows = true;
    if (this.clipVolume) out.clipVol = true;
    if (this.hLineMaterialColors) out.hlMatColors = true;
    if (this.monochrome) out.monochrome = true;
    if (this.backgroundMap) out.backgroundMap = true;
    if (this.edgeMask !== 0) out.edgeMask = this.edgeMask;
    if (this.ambientOcclusion) out.ambientOcclusion = true;
    if (this.thematicDisplay) out.thematicDisplay = true;
    if (this.forceSurfaceDiscard) out.forceSurfaceDiscard = true;
    if (!this.whiteOnWhiteReversal) out.noWhiteOnWhiteReversal = true;

    out.renderMode = this.renderMode;
    return out;
  }

  /** Like [[toJSON]], but no properties are omitted.
   * @internal
   */
  public toFullyDefinedJSON(): Required<ViewFlagProps> {
    return {
      renderMode: this.renderMode,
      noConstruct: !this.constructions,
      noDim: !this.dimensions,
      noPattern: !this.patterns,
      noWeight: !this.weights,
      noStyle: !this.styles,
      noTransp: !this.transparency,
      noFill: !this.fill,
      grid: this.grid,
      acs: this.acsTriad,
      noTexture: !this.textures,
      noMaterial: !this.materials,
      noCameraLights: !this.cameraLights,
      noSourceLights: !this.sourceLights,
      noSolarLight: !this.solarLight,
      visEdges: this.visibleEdges,
      hidEdges: this.hiddenEdges,
      shadows: this.shadows,
      clipVol: this.clipVolume,
      hlMatColors: this.hLineMaterialColors,
      monochrome: this.monochrome,
      backgroundMap: this.backgroundMap,
      edgeMask: this.edgeMask,
      ambientOcclusion: this.ambientOcclusion,
      thematicDisplay: this.thematicDisplay,
      forceSurfaceDiscard: this.forceSurfaceDiscard,
      noWhiteOnWhiteReversal: !this.whiteOnWhiteReversal,
    };
  }

  public static fromJSON(json?: ViewFlagProps): ViewFlags {
    const val = new ViewFlags();
    if (!json)
      return val;

    val.constructions = !JsonUtils.asBool(json.noConstruct);
    val.dimensions = !JsonUtils.asBool(json.noDim);
    val.patterns = !JsonUtils.asBool(json.noPattern);
    val.weights = !JsonUtils.asBool(json.noWeight);
    val.styles = !JsonUtils.asBool(json.noStyle);
    val.transparency = !JsonUtils.asBool(json.noTransp);
    val.fill = !JsonUtils.asBool(json.noFill);
    val.grid = JsonUtils.asBool(json.grid);
    val.acsTriad = JsonUtils.asBool(json.acs);
    val.textures = !JsonUtils.asBool(json.noTexture);
    val.materials = !JsonUtils.asBool(json.noMaterial);
    val.cameraLights = !JsonUtils.asBool(json.noCameraLights);
    val.sourceLights = !JsonUtils.asBool(json.noSourceLights);
    val.solarLight = !JsonUtils.asBool(json.noSolarLight);
    val.visibleEdges = JsonUtils.asBool(json.visEdges);
    val.hiddenEdges = JsonUtils.asBool(json.hidEdges);
    val.shadows = JsonUtils.asBool(json.shadows);
    val.clipVolume = JsonUtils.asBool(json.clipVol);
    val.monochrome = JsonUtils.asBool(json.monochrome);
    val.edgeMask = JsonUtils.asInt(json.edgeMask);
    val.hLineMaterialColors = JsonUtils.asBool(json.hlMatColors);
    val.backgroundMap = JsonUtils.asBool(json.backgroundMap);
    val.ambientOcclusion = JsonUtils.asBool(json.ambientOcclusion);
    val.thematicDisplay = JsonUtils.asBool(json.thematicDisplay);
    val.forceSurfaceDiscard = JsonUtils.asBool(json.forceSurfaceDiscard);
    val.whiteOnWhiteReversal = !JsonUtils.asBool(json.noWhiteOnWhiteReversal);

    const renderModeValue = JsonUtils.asInt(json.renderMode);
    if (renderModeValue < RenderMode.HiddenLine)
      val.renderMode = RenderMode.Wireframe;
    else if (renderModeValue > RenderMode.SolidFill)
      val.renderMode = RenderMode.SmoothShade;
    else
      val.renderMode = renderModeValue;

    return val;
  }

  public equals(other: ViewFlags): boolean {
    return this.renderMode === other.renderMode
      && this.dimensions === other.dimensions
      && this.patterns === other.patterns
      && this.weights === other.weights
      && this.styles === other.styles
      && this.transparency === other.transparency
      && this.fill === other.fill
      && this.textures === other.textures
      && this.materials === other.materials
      && this.acsTriad === other.acsTriad
      && this.grid === other.grid
      && this.visibleEdges === other.visibleEdges
      && this.hiddenEdges === other.hiddenEdges
      && this.sourceLights === other.sourceLights
      && this.cameraLights === other.cameraLights
      && this.solarLight === other.solarLight
      && this.shadows === other.shadows
      && this.clipVolume === other.clipVolume
      && this.constructions === other.constructions
      && this.monochrome === other.monochrome
      && this.noGeometryMap === other.noGeometryMap
      && this.hLineMaterialColors === other.hLineMaterialColors
      && this.backgroundMap === other.backgroundMap
      && this.edgeMask === other.edgeMask
      && this.ambientOcclusion === other.ambientOcclusion
      && this.thematicDisplay === other.thematicDisplay
      && this.forceSurfaceDiscard === other.forceSurfaceDiscard
      && this.whiteOnWhiteReversal === other.whiteOnWhiteReversal;
  }
}

/** Values used by [[ViewFlagOverrides]] to indicate which aspects of the [[ViewFlags]] are overridden.
 * @public
 */
export enum ViewFlagPresence {
  RenderMode, // eslint-disable-line @typescript-eslint/no-shadow
  Dimensions,
  Patterns,
  Weights,
  Styles,
  Transparency,
  Unused,
  Fill,
  Textures,
  Materials,
  VisibleEdges,
  HiddenEdges,
  Lighting,
  Shadows,
  ClipVolume,
  Constructions,
  Monochrome,
  GeometryMap,
  HlineMaterialColors,
  EdgeMask,
  BackgroundMap,
  ForceSurfaceDiscard,
  WhiteOnWhiteReversal,
  ThematicDisplay,
}

/** JSON representation of [[ViewFlagOverrides]]. A flag is overridden if it is defined.
 * @public
 */
export interface ViewFlagOverridesProps {
  dimensions?: boolean;
  patterns?: boolean;
  weights?: boolean;
  styles?: boolean;
  transparency?: boolean;
  fill?: boolean;
  textures?: boolean;
  materials?: boolean;
  lighting?: boolean;
  visibleEdges?: boolean;
  hiddenEdges?: boolean;
  shadows?: boolean;
  clipVolume?: boolean;
  constructions?: boolean;
  monochrome?: boolean;
  noGeometryMap?: boolean;
  backgroundMap?: boolean;
  hLineMaterialColors?: boolean;
  forceSurfaceDiscard?: boolean;
  whiteOnWhiteReversal?: boolean;
  edgeMask?: number;
  renderMode?: RenderMode;
  thematicDisplay?: boolean;
}

/** Overrides a subset of [[ViewFlags]].
 * @public
 */
export class ViewFlagOverrides {
  private _present = 0;
  private readonly _values = new ViewFlags();

  /** Returns true if the specified flag is overridden. */
  public isPresent(flag: ViewFlagPresence): boolean { return 0 !== (this._present & (1 << flag)); }
  /** Mark the specified flag as overridden. */
  public setPresent(flag: ViewFlagPresence) { this._present |= (1 << flag); }
  /** Mark the specified flag as not overridden. */
  public clearPresent(flag: ViewFlagPresence) {
    // Bit-wise NOT produces signed one's complement in javascript...triple-shift right by zero to get correct result...
    this._present &= (~(1 << flag)) >>> 0;
  }

  /** Construct a ViewFlagOverrides which overrides all flags to match the specified ViewFlags, or overrides nothing if no ViewFlags are supplied. */
  constructor(flags?: ViewFlags) {
    if (undefined !== flags)
      this.overrideAll(flags);
  }

  /** Marks all view flags as overridden.
   * @param flags If supplied, these overrides will match the input view flags; otherwise, they will match the default view flags.
   */
  public overrideAll(flags?: ViewFlags) {
    ViewFlags.createFrom(flags, this._values);
    this._present = 0xffffffff;
  }

  /** Create a copy of these overrides.
   * @param out If supplied, the input overrides will be modified to match these overrides; otherwise, a new ViewFlagOverrides object will be created as the clone.
   * @returns A copy of these overrides.
   */
  public clone(out?: ViewFlagOverrides): ViewFlagOverrides {
    const result = undefined !== out ? out : new ViewFlagOverrides();
    result.copyFrom(this);
    return result;
  }

  /** Modify these overrides to match the input overrides. */
  public copyFrom(other: ViewFlagOverrides): void {
    other._values.clone(this._values);
    this._present = other._present;
  }

  public setShowDimensions(val: boolean) { this._values.dimensions = val; this.setPresent(ViewFlagPresence.Dimensions); }
  public setShowPatterns(val: boolean) { this._values.patterns = val; this.setPresent(ViewFlagPresence.Patterns); }
  public setShowWeights(val: boolean) { this._values.weights = val; this.setPresent(ViewFlagPresence.Weights); }
  public setShowStyles(val: boolean) { this._values.styles = val; this.setPresent(ViewFlagPresence.Styles); }
  public setShowTransparency(val: boolean) { this._values.transparency = val; this.setPresent(ViewFlagPresence.Transparency); }
  public setShowFill(val: boolean) { this._values.fill = val; this.setPresent(ViewFlagPresence.Fill); }
  public setShowTextures(val: boolean) { this._values.textures = val; this.setPresent(ViewFlagPresence.Textures); }
  public setShowMaterials(val: boolean) { this._values.materials = val; this.setPresent(ViewFlagPresence.Materials); }
  public setApplyLighting(val: boolean) { this._values.lighting = val; this.setPresent(ViewFlagPresence.Lighting); }
  public setShowVisibleEdges(val: boolean) { this._values.visibleEdges = val; this.setPresent(ViewFlagPresence.VisibleEdges); }
  public setShowHiddenEdges(val: boolean) { this._values.hiddenEdges = val; this.setPresent(ViewFlagPresence.HiddenEdges); }
  public setShowShadows(val: boolean) { this._values.shadows = val; this.setPresent(ViewFlagPresence.Shadows); }
  public setShowClipVolume(val: boolean) { this._values.clipVolume = val; this.setPresent(ViewFlagPresence.ClipVolume); }
  public setShowConstructions(val: boolean) { this._values.constructions = val; this.setPresent(ViewFlagPresence.Constructions); }
  public setMonochrome(val: boolean) { this._values.monochrome = val; this.setPresent(ViewFlagPresence.Monochrome); }
  public setIgnoreGeometryMap(val: boolean) { this._values.noGeometryMap = val; this.setPresent(ViewFlagPresence.GeometryMap); }
  public setShowBackgroundMap(val: boolean) { this._values.backgroundMap = val; this.setPresent(ViewFlagPresence.BackgroundMap); }
  public setUseHlineMaterialColors(val: boolean) { this._values.hLineMaterialColors = val; this.setPresent(ViewFlagPresence.HlineMaterialColors); }
  public setForceSurfaceDiscard(val: boolean) { this._values.forceSurfaceDiscard = val; this.setPresent(ViewFlagPresence.ForceSurfaceDiscard); }
  public setWhiteOnWhiteReversal(val: boolean) { this._values.whiteOnWhiteReversal = val; this.setPresent(ViewFlagPresence.WhiteOnWhiteReversal); }
  public setEdgeMask(val: number) { this._values.edgeMask = val; this.setPresent(ViewFlagPresence.EdgeMask); }
  public setRenderMode(val: RenderMode) { this._values.renderMode = val; this.setPresent(ViewFlagPresence.RenderMode); }
  public setThematicDisplay(val: boolean) { this._values.thematicDisplay = val; this.setPresent(ViewFlagPresence.ThematicDisplay); }

  /** Return whether these overrides applied to the specified ViewFlags require edges to be drawn.
   * @beta
   */
  public edgesRequired(viewFlags: ViewFlags): boolean {
    const renderMode = this.isPresent(ViewFlagPresence.RenderMode) ? this._values.renderMode : viewFlags.renderMode;
    const visibleEdges = this.isPresent(ViewFlagPresence.VisibleEdges) ? this._values.visibleEdges : viewFlags.visibleEdges;
    return edgesRequired(renderMode, visibleEdges);
  }

  /** Returns true if any view flags are overridden. */
  public anyOverridden() { return 0 !== this._present; }

  /** Marks all view flags as not overridden. */
  public clear() { this._present = 0; }

  public clearClipVolume() { this.clearPresent(ViewFlagPresence.ClipVolume); }

  /** If ViewFlags.clipVolume is overridden, return the override value; else return undefined.
   * @internal
   */
  public get clipVolumeOverride(): boolean | undefined {
    return this.isPresent(ViewFlagPresence.ClipVolume) ? this._values.clipVolume : undefined;
  }

  /** Apply these overrides to the supplied ViewFlags. The values of any flags that are overridden will be replaced by the override values; the rest of the flags are untouched. */
  public apply(base: ViewFlags): ViewFlags {
    this.applyFlags(base);
    return base;
  }

  public toJSON(): ViewFlagOverridesProps {
    const props: ViewFlagOverridesProps = {};
    this.applyFlags(props);
    return props;
  }

  public static fromJSON(props?: ViewFlagOverridesProps): ViewFlagOverrides {
    const ovrs = new ViewFlagOverrides();
    if (!props)
      return ovrs;

    const setBoolean = (key: keyof ViewFlagOverridesProps, set: (val: boolean) => void) => {
      const val = props[key];
      if (typeof val === "boolean")
        set(val);
    };

    setBoolean("dimensions", (val) => ovrs.setShowDimensions(val));
    setBoolean("patterns", (val) => ovrs.setShowPatterns(val));
    setBoolean("weights", (val) => ovrs.setShowWeights(val));
    setBoolean("styles", (val) => ovrs.setShowStyles(val));
    setBoolean("transparency", (val) => ovrs.setShowTransparency(val));
    setBoolean("fill", (val) => ovrs.setShowFill(val));
    setBoolean("textures", (val) => ovrs.setShowTextures(val));
    setBoolean("materials", (val) => ovrs.setShowMaterials(val));
    setBoolean("lighting", (val) => ovrs.setApplyLighting(val));
    setBoolean("visibleEdges", (val) => ovrs.setShowVisibleEdges(val));
    setBoolean("hiddenEdges", (val) => ovrs.setShowHiddenEdges(val));
    setBoolean("shadows", (val) => ovrs.setShowShadows(val));
    setBoolean("clipVolume", (val) => ovrs.setShowClipVolume(val));
    setBoolean("constructions", (val) => ovrs.setShowConstructions(val));
    setBoolean("monochrome", (val) => ovrs.setMonochrome(val));
    setBoolean("noGeometryMap", (val) => ovrs.setIgnoreGeometryMap(val));
    setBoolean("backgroundMap", (val) => ovrs.setShowBackgroundMap(val));
    setBoolean("hLineMaterialColors", (val) => ovrs.setUseHlineMaterialColors(val));
    setBoolean("forceSurfaceDiscard", (val) => ovrs.setForceSurfaceDiscard(val));
    setBoolean("whiteOnWhiteReversal", (val) => ovrs.setWhiteOnWhiteReversal(val));
    setBoolean("thematicDisplay", (val) => ovrs.setThematicDisplay(val));

    if (typeof props.edgeMask === "number")
      ovrs.setEdgeMask(props.edgeMask);

    if (typeof props.renderMode === "number")
      ovrs.setRenderMode(props.renderMode);

    return ovrs;
  }

  private applyFlags(flags: ViewFlags | ViewFlagOverridesProps): void {
    if (!this.anyOverridden())
      return;

    if (this.isPresent(ViewFlagPresence.Dimensions)) flags.dimensions = this._values.dimensions;
    if (this.isPresent(ViewFlagPresence.Patterns)) flags.patterns = this._values.patterns;
    if (this.isPresent(ViewFlagPresence.Weights)) flags.weights = this._values.weights;
    if (this.isPresent(ViewFlagPresence.Styles)) flags.styles = this._values.styles;
    if (this.isPresent(ViewFlagPresence.Transparency)) flags.transparency = this._values.transparency;
    if (this.isPresent(ViewFlagPresence.Fill)) flags.fill = this._values.fill;
    if (this.isPresent(ViewFlagPresence.Textures)) flags.textures = this._values.textures;
    if (this.isPresent(ViewFlagPresence.Materials)) flags.materials = this._values.materials;
    if (this.isPresent(ViewFlagPresence.Lighting)) flags.lighting = this._values.lighting;
    if (this.isPresent(ViewFlagPresence.VisibleEdges)) flags.visibleEdges = this._values.visibleEdges;
    if (this.isPresent(ViewFlagPresence.HiddenEdges)) flags.hiddenEdges = this._values.hiddenEdges;
    if (this.isPresent(ViewFlagPresence.Shadows)) flags.shadows = this._values.shadows;
    if (this.isPresent(ViewFlagPresence.ClipVolume)) flags.clipVolume = this._values.clipVolume;
    if (this.isPresent(ViewFlagPresence.Constructions)) flags.constructions = this._values.constructions;
    if (this.isPresent(ViewFlagPresence.Monochrome)) flags.monochrome = this._values.monochrome;
    if (this.isPresent(ViewFlagPresence.GeometryMap)) flags.noGeometryMap = this._values.noGeometryMap;
    if (this.isPresent(ViewFlagPresence.BackgroundMap)) flags.backgroundMap = this._values.backgroundMap;
    if (this.isPresent(ViewFlagPresence.HlineMaterialColors)) flags.hLineMaterialColors = this._values.hLineMaterialColors;
    if (this.isPresent(ViewFlagPresence.ForceSurfaceDiscard)) flags.forceSurfaceDiscard = this._values.forceSurfaceDiscard;
    if (this.isPresent(ViewFlagPresence.WhiteOnWhiteReversal)) flags.whiteOnWhiteReversal = this._values.whiteOnWhiteReversal;
    if (this.isPresent(ViewFlagPresence.EdgeMask)) flags.edgeMask = this._values.edgeMask;
    if (this.isPresent(ViewFlagPresence.RenderMode)) flags.renderMode = this._values.renderMode;
    if (this.isPresent(ViewFlagPresence.ThematicDisplay)) flags.thematicDisplay = this._values.thematicDisplay;
  }
}
