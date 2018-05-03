/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { FragmentShaderBuilder, VariableType } from "../ShaderBuilder";
import { RenderMode, Hilite } from "@bentley/imodeljs-common";
import { FloatRgba } from "../FloatRGBA";

export function addHiliteSettings(frag: FragmentShaderBuilder): void {
  frag.addUniform("u_hilite_color", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_hilite_color", (uniform, params) => {
      const vf = params.target.currentViewFlags;
      const useLighting = RenderMode.SmoothShade === vf.renderMode && params.geometry.isLitSurface &&
        (vf.showSourceLights() || vf.showCameraLights() || vf.showSolarLight());
      const transparency = useLighting ? 0 : 255;
      const hiliteColor = FloatRgba.fromColorDef(params.target.hiliteSettings.color, transparency);
      hiliteColor.bind(uniform);
    });
  });

  frag.addUniform("u_hilite_settings", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_hilite_settings", (uniform, params) => {
      const hilite = params.target.hiliteSettings;
      let silhouette = 2.0;
      switch (hilite.silhouette) {
        case Hilite.Silhouette.None:  silhouette = 0.0; break;
        case Hilite.Silhouette.Thin:  silhouette = 1.0; break;
      }

      // During the normal pass (with depth testing), we mix the hilite color with the element color.
      // During the compositing pass, we mix the hilite color with the fragment color.
      // We have no idea if we're hiliting an occluded or visible portion of the hilited element.
      const hidden = hilite.hiddenRatio;
      const visible = Math.max(0, hilite.visibleRatio - hidden);
      uniform.setUniform3fv([ visible, hidden, silhouette ]);
    });
  });
}
