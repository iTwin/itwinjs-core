/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { ProgramBuilder, FragmentShaderBuilder } from "../ShaderBuilder";
import { FeatureMode, WithClipVolume } from "../TechniqueFlags";

export function addMaterial(_frag: FragmentShaderBuilder): void {
}

export function createSurfaceHiliter(_clip: WithClipVolume): ProgramBuilder {
}

export function createSurfaceBuilder(_featureMode: FeatureMode, _clip: WithClipVolume): ProgramBuilder {
}
