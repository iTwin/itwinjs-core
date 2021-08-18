/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

// cspell:ignore ovrs

import { JsonUtils, Mutable, NonFunctionPropertiesOf } from "@bentley/bentleyjs-core";

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
  /** If true, all lines are drawn with a width of 1 pixel. */
  noWeight?: boolean;
  /** If true, don't apply [[LinePixels]] styles. */
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
  /** If true, show view with monochrome settings. */
  monochrome?: boolean;
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

/** Flags controlling how graphics appear within a view.
 * @see [[DisplayStyleSettings.viewFlags]] to define the view flags for a [DisplayStyle]($backend).
 * @public
 */
export class ViewFlags {
  /** The basic rendering mode applied to the view. This modulates the behavior of some of the other flags.
    * For example, the [[lighting]] and [[visibleEdges]] flags are ignored unless the render mode is [[RenderMode.SmoothShade]].
    */
  public readonly renderMode: RenderMode;
  /** Shows or hides dimensions. */
  public readonly dimensions: boolean;
  /** Shows or hides pattern geometry. */
  public readonly patterns: boolean;
  /** Controls whether non-zero line weights are used or display using weight 0. */
  public readonly weights: boolean;
  /** Controls whether custom line styles are used (e.g. control whether elements with custom line styles draw normally, or as solid lines). */
  public readonly styles: boolean;
  /** Controls whether element transparency is used (e.g. control whether elements with transparency draw normally, or as opaque). */
  public readonly transparency: boolean;
  /** Controls whether the fills on filled elements are displayed. */
  public readonly fill: boolean;
  /** Controls whether to display texture maps for material assignments. When off only material color is used for display. */
  public readonly textures: boolean;
  /** Controls whether materials are used (e.g. control whether geometry with materials draw normally, or as if it has no material). */
  public readonly materials: boolean;
  /** Shows or hides the ACS triad. */
  public readonly acsTriad: boolean;
  /** Shows or hides the grid. The grid settings are a design file setting. */
  public readonly grid: boolean;
  /** Shows or hides visible edges in the shaded render mode. */
  public readonly visibleEdges: boolean;
  /** Shows or hides hidden edges in the shaded render mode. */
  public readonly hiddenEdges: boolean;
  /** Controls whether the source lights in spatial models are used
   * @note Currently the renderer only supports solar lighting. For backwards-compatibility reasons, solar lights will be displayed if any combination of [[noCameraLights]], [[noSourceLights]], or [[noSolarLight]] is set to `false`.
   * @see [[lighting]] for a more convenient way to toggle lighting on and off.
   */
  public readonly sourceLights: boolean;
  /** Controls whether camera (ambient, portrait, flashbulb) lights are used.
   * @note Currently the renderer only supports solar lighting. For backwards-compatibility reasons, solar lights will be displayed if any combination of [[noCameraLights]], [[noSourceLights]], or [[noSolarLight]] is set to `false`.
   * @see [[lighting]] for a more convenient way to toggle lighting on and off.
   */
  public readonly cameraLights: boolean;
  /** Controls whether sunlight used
   * @note Currently the renderer only supports solar lighting. For backwards-compatibility reasons, solar lights will be displayed if any combination of [[noCameraLights]], [[noSourceLights]], or [[noSolarLight]] is set to `false`.
   * @see [[lighting]] for a more convenient way to toggle lighting on and off.
   */
  public readonly solarLight: boolean;
  /** Shows or hides shadows. */
  public readonly shadows: boolean;
  /** Controls whether the view's clip volume is applied. Has no effect on other types of clips like [[ModelClipGroups]]. */
  public readonly clipVolume: boolean;
  /** Shows or hides construction class geometry. */
  public readonly constructions: boolean;
  /** Draw geometry using the view's monochrome color.
   * @see [DisplayStyleSettings.monochromeColor]($common) for details on how the color is applied.
   * @see [DisplayStyleSettings.monochromeMode]($common) to control the type of monochrome display applied.
   */
  public readonly monochrome: boolean;
  /** Display background map */
  public readonly backgroundMap: boolean;
  /** Controls whether ambient occlusion is used. */
  public readonly ambientOcclusion: boolean;
  /** Controls whether thematic display is used.
   * @note Currently, thematically displayed geometry will not receive shadows. If thematic display is enabled, shadows will not be received by thematically displayed geometry, even if shadows are enabled.
   */
  public readonly thematicDisplay: boolean;
  /** Controls whether surface discard is always applied regardless of other ViewFlags.
   * Surface shaders contain complicated logic to ensure that the edges of a surface always draw in front of the surface, and that planar surfaces sketched coincident with
   * non-planar surfaces always draw in front of those non-planar surfaces.
   * When this view flag is set to false (the default), then for 3d views if the render mode is wireframe (only edges are displayed) or smooth shader with visible edges turned off (only surfaces are displayed),
   * that logic does not execute, potentially improving performance for no degradation in visual quality. In some scenarios - such as wireframe views containing many planar regions with interior fill, or smooth views containing many coincident planar and non-planar surfaces - enabling this view flag improves display quality by forcing that logic to execute.
   */
  public readonly forceSurfaceDiscard: boolean;
  /** White-on-white reversal is used by some CAD applications to cause white geometry to be drawn as black if the view's background color is also white. */
  public readonly whiteOnWhiteReversal: boolean;

  /** Controls whether or not lighting is applied.
   * @note Has no effect unless `renderMode` is set to [[RenderMode.SmoothShade]].
   */
  public get lighting(): boolean { return this.solarLight || this.sourceLights || this.cameraLights; }

  public constructor(flags?: Partial<ViewFlagsProperties>) {
    this.renderMode = flags?.renderMode ?? RenderMode.Wireframe;
    this.dimensions = flags?.dimensions ?? true;
    this.patterns = flags?.patterns ?? true;
    this.weights = flags?.weights ?? true;
    this.styles = flags?.styles ?? true;
    this.transparency = flags?.transparency ?? true;
    this.fill = flags?.fill ?? true;
    this.textures = flags?.textures ?? true;
    this.materials = flags?.materials ?? true;
    this.acsTriad = flags?.acsTriad ?? false;
    this.grid = flags?.grid ?? false;
    this.visibleEdges = flags?.visibleEdges ?? false;
    this.hiddenEdges = flags?.hiddenEdges ?? false;
    this.shadows = flags?.shadows ?? false;
    this.clipVolume = flags?.clipVolume ?? true;
    this.constructions = flags?.constructions ?? false;
    this.monochrome = flags?.monochrome ?? false;
    this.backgroundMap = flags?.backgroundMap ?? false;
    this.ambientOcclusion = flags?.ambientOcclusion ?? false;
    this.thematicDisplay = flags?.thematicDisplay ?? false;
    this.forceSurfaceDiscard = flags?.forceSurfaceDiscard ?? false;
    this.whiteOnWhiteReversal = flags?.whiteOnWhiteReversal ?? true;

    if (undefined !== flags?.lighting) {
      this.solarLight = this.sourceLights = this.cameraLights = flags.lighting;
    } else {
      this.sourceLights = flags?.sourceLights ?? false;
      this.cameraLights = flags?.cameraLights ?? false;
      this.solarLight = flags?.solarLight ?? false;
    }
  }

  /** Produce a copy of these ViewFlags with some modified properties. Any properties not explicitly specified by `changedFlags` will retain their current values.
   * @param changedFlags Properties to modify.
   * @returns A copy of these ViewFlags modified according to the supplied properties.
   * @note Any explicitly `undefined` property of `changedFlags` will be set to its default value in the returned ViewFlags.
   * @see [[override]] to have `undefined` properties retain their current values.
   */
  public copy(changedFlags: Partial<ViewFlagsProperties>): ViewFlags {
    return JsonUtils.isNonEmptyObject(changedFlags) ? new ViewFlags({ ...this, ...changedFlags }) : this;
  }

  /** Produce a copy of these ViewFlags, overriding some of its properties. Any properties not explicitly specified by `overrides` will retain their current values,
   * as will any property explicitly set to `undefined`.
   * @param overrides The properties to override.
   * @see [[copy]] to have `undefined` properties reset to their default values.
   */
  public override(overrides: Partial<ViewFlagsProperties>): ViewFlags {
    // Create a copy of the input with all undefined ViewFlags properties removed.
    // Note we use the keys of `ViewFlags.defaults` instead of those of the input to avoid processing additional unrelated properties that may be present on input.
    overrides = { ...overrides };
    for (const propName of Object.keys(ViewFlags.defaults)) {
      const key = propName as keyof Partial<ViewFlagsProperties>;
      if (undefined === overrides[key])
        delete overrides[key];
    }

    return this.copy(overrides);
  }

  public with(flag: keyof Omit<ViewFlagsProperties, "renderMode">, value: boolean): ViewFlags {
    if (this[flag] === value)
      return this;

    const props: ViewFlagsProperties = { ...this };
    props[flag] = false;
    return new ViewFlags(props);
  }

  public withRenderMode(renderMode: RenderMode): ViewFlags {
    return renderMode === this.renderMode ? this : this.copy({ renderMode });
  }

  /** Adjust view flags for renderer.
   * @internal
   */
  public normalize(): ViewFlags {
    switch (this.renderMode) {
      case RenderMode.Wireframe:
        if (this.visibleEdges || this.hiddenEdges)
          return this.copy({ visibleEdges: false, hiddenEdges: false });
        break;
      case RenderMode.SmoothShade:
        if (!this.visibleEdges)
          return this.copy({ hiddenEdges: false });
        break;
      case RenderMode.HiddenLine:
      case RenderMode.SolidFill:
        if (!this.visibleEdges || this.transparency)
          return this.copy({ visibleEdges: true, transparency: false });
        break;
    }

    return this;
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

  /** Returns true if the edges of surfaces should be displayed, based on [[RenderMode]] and the [[visibleEdges]] flag. */
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
    if (this.monochrome) out.monochrome = true;
    if (this.backgroundMap) out.backgroundMap = true;
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
      monochrome: this.monochrome,
      backgroundMap: this.backgroundMap,
      ambientOcclusion: this.ambientOcclusion,
      thematicDisplay: this.thematicDisplay,
      forceSurfaceDiscard: this.forceSurfaceDiscard,
      noWhiteOnWhiteReversal: !this.whiteOnWhiteReversal,
    };
  }

  public static readonly defaults = new ViewFlags();

  public static create(flags?: Partial<ViewFlagsProperties>): ViewFlags {
    return flags && !JsonUtils.isEmptyObject(flags) ? new ViewFlags(flags) : this.defaults;
  }

  public static fromJSON(json?: ViewFlagProps): ViewFlags {
    if (!json)
      return this.defaults;

    let renderMode: RenderMode;
    const renderModeValue = JsonUtils.asInt(json.renderMode);
    if (renderModeValue < RenderMode.HiddenLine)
      renderMode = RenderMode.Wireframe;
    else if (renderModeValue > RenderMode.SolidFill)
      renderMode = RenderMode.SmoothShade;
    else
      renderMode = renderModeValue;

    return new ViewFlags({
      renderMode,
      constructions: !JsonUtils.asBool(json.noConstruct),
      dimensions: !JsonUtils.asBool(json.noDim),
      patterns: !JsonUtils.asBool(json.noPattern),
      weights: !JsonUtils.asBool(json.noWeight),
      styles: !JsonUtils.asBool(json.noStyle),
      transparency: !JsonUtils.asBool(json.noTransp),
      fill: !JsonUtils.asBool(json.noFill),
      grid: JsonUtils.asBool(json.grid),
      acsTriad: JsonUtils.asBool(json.acs),
      textures: !JsonUtils.asBool(json.noTexture),
      materials: !JsonUtils.asBool(json.noMaterial),
      cameraLights: !JsonUtils.asBool(json.noCameraLights),
      sourceLights: !JsonUtils.asBool(json.noSourceLights),
      solarLight: !JsonUtils.asBool(json.noSolarLight),
      visibleEdges: JsonUtils.asBool(json.visEdges),
      hiddenEdges: JsonUtils.asBool(json.hidEdges),
      shadows: JsonUtils.asBool(json.shadows),
      clipVolume: JsonUtils.asBool(json.clipVol),
      monochrome: JsonUtils.asBool(json.monochrome),
      backgroundMap: JsonUtils.asBool(json.backgroundMap),
      ambientOcclusion: JsonUtils.asBool(json.ambientOcclusion),
      thematicDisplay: JsonUtils.asBool(json.thematicDisplay),
      forceSurfaceDiscard: JsonUtils.asBool(json.forceSurfaceDiscard),
      whiteOnWhiteReversal: !JsonUtils.asBool(json.noWhiteOnWhiteReversal),
    });
  }

  public equals(other: Readonly<ViewFlagsProperties>): boolean {
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
      && this.backgroundMap === other.backgroundMap
      && this.ambientOcclusion === other.ambientOcclusion
      && this.thematicDisplay === other.thematicDisplay
      && this.forceSurfaceDiscard === other.forceSurfaceDiscard
      && this.whiteOnWhiteReversal === other.whiteOnWhiteReversal;
  }
}

export type ViewFlagsProperties = Mutable<NonFunctionPropertiesOf<ViewFlags>>;

export type ViewFlagOverrides = Partial<ViewFlagsProperties>;
