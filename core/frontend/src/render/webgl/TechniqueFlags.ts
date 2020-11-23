/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { RenderMode } from "@bentley/imodeljs-common";
import { RenderPass } from "./RenderFlags";
import { Target } from "./Target";

/* eslint-disable no-restricted-syntax */

/** Specifies how a TechniqueFlags handles feature table/overrides.
 * @internal
 */
export const enum FeatureMode {
  None,       // no features
  Pick,       // feature table only
  Overrides,  // feature table with symbology overrides
}

/** @internal */
export const enum IsInstanced { No, Yes }

/** @internal */
export const enum IsAnimated { No, Yes }

/** @internal */
export const enum IsClassified { No, Yes }

/** @internal */
export const enum IsEdgeTestNeeded { No, Yes }

/** @internal */
export const enum IsShadowable { No, Yes }

/** @internal */
export const enum IsThematic { No, Yes }

/** Flags used to control which shader program is used by a rendering Technique.
 * @internal
 */
export class TechniqueFlags {
  /** System will set this to true upon initialization if necessary. */
  public static requireEdgeTest = false;

  private _isEdgeTestNeeded: IsEdgeTestNeeded = IsEdgeTestNeeded.No;
  public numClipPlanes = 0;
  public featureMode = FeatureMode.None;
  public isTranslucent: boolean;
  public isAnimated: IsAnimated = IsAnimated.No;
  public isInstanced: IsInstanced = IsInstanced.No;
  public isClassified: IsClassified = IsClassified.No;
  public isShadowable: IsShadowable = IsShadowable.No;
  public isThematic: IsThematic = IsThematic.No;
  private _isHilite = false;

  public constructor(translucent: boolean = false) {
    this.isTranslucent = translucent;
  }

  public get hasClip(): boolean {
    return this.numClipPlanes > 0;
  }

  public get isEdgeTestNeeded(): IsEdgeTestNeeded {
    return TechniqueFlags.requireEdgeTest ? IsEdgeTestNeeded.Yes : this._isEdgeTestNeeded;
  }

  public set isEdgeTestNeeded(needed: IsEdgeTestNeeded) {
    this._isEdgeTestNeeded = needed;
  }

  public init(target: Target, pass: RenderPass, instanced: IsInstanced, animated: IsAnimated = IsAnimated.No, classified = IsClassified.No, shadowable = IsShadowable.No, thematic = IsThematic.No): void {
    const numClipPlanes = target.currentClipVolume?.texture?.height ?? 0;
    if (RenderPass.Hilite === pass || RenderPass.HiliteClassification === pass || RenderPass.HilitePlanarClassification === pass) {
      const isClassified = (classified === IsClassified.Yes && RenderPass.HilitePlanarClassification === pass) ? IsClassified.Yes : IsClassified.No;
      this.initForHilite(numClipPlanes, instanced, isClassified);
    } else {
      this._isHilite = false;
      this.isTranslucent = RenderPass.Translucent === pass;
      this.numClipPlanes = numClipPlanes;
      this.isAnimated = animated;
      this.isInstanced = instanced;
      this.isClassified = classified;
      this.isShadowable = shadowable;
      this.isThematic = thematic;
      this.featureMode = target.uniforms.batch.featureMode;

      // Determine if we should use the shaders which support discarding surfaces in favor of their edges (and discarding non-planar surfaces in favor of coincident planar surfaces).
      // These are only useful if the geometry defines feature Ids.
      // In 3d, if we're only displaying surfaces or edges, not both, don't bother, unless forceSurfaceDiscard is true.
      this.isEdgeTestNeeded = this.hasFeatures ? (this.isClassified ? IsEdgeTestNeeded.No : IsEdgeTestNeeded.Yes) : IsEdgeTestNeeded.No;
      if (!target.currentViewFlags.forceSurfaceDiscard && target.is3d && !target.isReadPixelsInProgress && this.isEdgeTestNeeded) {
        switch (target.currentViewFlags.renderMode) {
          case RenderMode.Wireframe:
            // We're only displaying edges (ignoring filled planar regions)
            this.isEdgeTestNeeded = IsEdgeTestNeeded.No;
            break;
          case RenderMode.SmoothShade:
            if (!target.currentViewFlags.visibleEdges && !target.wantAmbientOcclusion && pass !== RenderPass.PlanarClassification) {
              // We're only displaying surfaces (ignoring filled planar regions).
              // NB: Filled text (blanking region) is handled by adjusting the depth in the surface vertex shader.
              this.isEdgeTestNeeded = IsEdgeTestNeeded.No;
            }
            break;
          default:
            // SolidFill and HiddenLine always display edges and surfaces.
            break;
        }
      }
    }
  }

  public reset(mode: FeatureMode, instanced: IsInstanced = IsInstanced.No, shadowable: IsShadowable, thematic: IsThematic) {
    this._isHilite = false;
    this.featureMode = mode;
    this.isTranslucent = false;
    this.isEdgeTestNeeded = IsEdgeTestNeeded.No;
    this.isAnimated = IsAnimated.No;
    this.isClassified = IsClassified.No;
    this.isInstanced = instanced;
    this.isShadowable = shadowable;
    this.isThematic = thematic;
    this.numClipPlanes = 0;
  }

  public get hasFeatures() { return FeatureMode.None !== this.featureMode; }

  public setAnimated(animated: boolean) { this.isAnimated = animated ? IsAnimated.Yes : IsAnimated.No; }
  public setInstanced(instanced: boolean) { this.isInstanced = instanced ? IsInstanced.Yes : IsInstanced.No; }
  public setClassified(classified: boolean) {
    this.isClassified = classified ? IsClassified.Yes : IsClassified.No;
  }

  public get isHilite() { return this._isHilite; }
  public initForHilite(numClipPlanes: number, instanced: IsInstanced, classified: IsClassified) {
    this.featureMode = classified ? FeatureMode.None : FeatureMode.Overrides;
    this._isHilite = true;
    this.isTranslucent = false;
    this.isEdgeTestNeeded = IsEdgeTestNeeded.No;
    this.isAnimated = IsAnimated.No;
    this.isInstanced = instanced;
    this.isClassified = classified;
    this.numClipPlanes = numClipPlanes;
  }

  public buildDescription(): string {
    const parts = [this.isTranslucent ? "Translucent" : "Opaque"];
    if (this.isInstanced) parts.push("Instanced");
    if (this.isEdgeTestNeeded) parts.push("EdgeTestNeeded");
    if (this.isAnimated) parts.push("Animated");
    if (this.isHilite) parts.push("Hilite");
    if (this.isClassified) parts.push("Classified");
    if (this.hasClip) parts.push("Clip");
    if (this.isShadowable) parts.push("Shadowable");
    if (this.isThematic) parts.push("Thematic");
    if (this.hasFeatures) parts.push(FeatureMode.Pick === this.featureMode ? "Pick" : "Overrides");
    return parts.join("-");
  }

  public static readonly defaults = new TechniqueFlags();
}
