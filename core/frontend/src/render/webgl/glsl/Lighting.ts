/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { ProgramBuilder } from "../ShaderBuilder";
import { addFrustum } from "./Common";

export function addLighting(builder: ProgramBuilder) {
  addFrustum(builder);
  // ###TODO: Finish implementing ShaderSource::Lighting::AddToBuilder here
}
