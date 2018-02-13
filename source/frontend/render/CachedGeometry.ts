/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BufferHandle } from "./Handle";
import { FeatureIndexType, FeatureIndex } from "./FeatureIndex";
import { GL } from "./GL";

export class FeatureIndices {
  public type: FeatureIndexType = FeatureIndexType.kEmpty;
  public uniform: number = 0;
  public nonUniform: BufferHandle | undefined = undefined;

  public constructor(src: FeatureIndex, numVerts: number, gl: WebGLRenderingContext) {
    this.type = src.type;
    switch (this.type) {
      case FeatureIndexType.kUniform:
        this.uniform = src.featureID;
        this.nonUniform = undefined;
        break;
      case FeatureIndexType.kNonUniform:
        this.nonUniform = new BufferHandle();
        this.nonUniform.init(gl);

        // WebGL doesn't support integers as vertex attributes. Use float.
        assert(undefined !== src.featureIDs);
        if (undefined !== src.featureIDs) {
          assert(src.featureIDs.length >= numVerts);
          const ab = new ArrayBuffer(numVerts * 4);
          const featureIDs: Float32Array = new Float32Array(ab);
          for (let i = 0; i < src.featureIDs.length; ++i) {
            featureIDs[i] = src.featureIDs[i];
          }
          this.nonUniform.bindData(gl, GL.Buffer.ArrayBuffer, numVerts * 4, GL.BufferUsage.StaticDraw, featureIDs);
        }
        break;
    }
  }

  public IsEmpty(): boolean { return FeatureIndexType.kEmpty === this.type; }
  public IsUniform(): boolean { return FeatureIndexType.kUniform === this.type; }
}
