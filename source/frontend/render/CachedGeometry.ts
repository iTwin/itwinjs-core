/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BufferHandle } from "./Handle";
import { FeatureIndexType, FeatureIndex } from "./FeatureIndex";
import { GL } from "./GL";

export class FeatureIndices {
  public type: FeatureIndexType;
  public uniform: number;
  public nonUniform: BufferHandle | undefined;

  public constructor(gl: WebGLRenderingContext, src: FeatureIndex, numVerts?: number) {
    this.type = src.type;
    switch (this.type) {
      case FeatureIndexType.kUniform:
        this.uniform = src.featureID;
        this.nonUniform = undefined;
        break;
      case FeatureIndexType.kNonUniform:
        this.uniform = 0;
        this.nonUniform = new BufferHandle();
        this.nonUniform.init(gl);

        assert(undefined !== src.featureIDs);
        assert(undefined !== numVerts);
        if (undefined !== src.featureIDs && undefined !== numVerts) {
          assert(src.featureIDs.length >= numVerts);
          // WebGL doesn't support integers as vertex attributes. Use float.
          const ab = new ArrayBuffer(numVerts * 4);
          const featureIDs: Float32Array = new Float32Array(ab);
          for (let i = 0; i < src.featureIDs.length; ++i) {
            featureIDs[i] = src.featureIDs[i];
          }
          this.nonUniform.bindData(gl, GL.Buffer.ArrayBuffer, numVerts * 4, GL.BufferUsage.StaticDraw, featureIDs);
        }
        break;
      default:
        this.uniform = 0;
        this.nonUniform = undefined;
        break;
    }
  }

  public isEmpty(): boolean { return FeatureIndexType.kEmpty === this.type; }
  public isUniform(): boolean { return FeatureIndexType.kUniform === this.type; }
}
