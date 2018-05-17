/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { QParams3d } from "@bentley/imodeljs-common";
import { IModelConnection } from "../../IModelConnection";
import { Primitive } from "./Primitive";
import { ProgramBuilder, VertexShaderComponent, VariableType, FragmentShaderComponent } from "./ShaderBuilder";
import { Target } from "./Target";
import { CachedGeometry, LUTGeometry } from "./CachedGeometry";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { TechniqueId } from "./TechniqueId";
import { WithClipVolume } from "./TechniqueFlags";
import { PolylineArgs } from "../primitives/mesh/MeshPrimitives";
import { VertexLUT } from "./VertexLUT";
import { FeaturesInfo } from "./FeaturesInfo";
import { addHiliter } from "./glsl/FeatureSymbology";
import { AttributeHandle, BufferHandle } from "./Handle";
import { addModelViewProjectionMatrix, GLSLVertex } from "./glsl/Vertex";
import { GL } from "./GL";
import { System } from "./System";
import { addClipping } from "./glsl/Clipping";
import { addShaderFlags } from "./glsl/Common";
import { addColor } from "./glsl/Color";
import { addWhiteOnWhiteReversal } from "./glsl/Fragment";

export class PointStringInfo {
  public vertexParams: QParams3d;
  public features: FeaturesInfo | undefined;
  public weight: number;

  public constructor(args: PolylineArgs) {
    this.vertexParams = args.pointParams;
    this.features = FeaturesInfo.create(args.features);
    this.weight = args.width;
  }
}

export class PointStringGeometry extends LUTGeometry {
  public readonly pointString: PointStringInfo;
  public readonly lut: VertexLUT.Data;
  public readonly indices: BufferHandle;
  public readonly numIndices: number;

  private constructor(indices: BufferHandle, numIndices: number, lut: VertexLUT.Data, info: PointStringInfo) {
    super();
    this.numIndices = numIndices;
    this.indices = indices;
    this.lut = lut;
    this.pointString = info;
  }

  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.PointString; }
  public getRenderPass(_target: Target): RenderPass { return RenderPass.OpaqueLinear; }
  public get renderOrder(): RenderOrder { return RenderOrder.PlanarLinear; }
  public bindVertexArray(attr: AttributeHandle): void {
    attr.enableArray(this.indices, 3, GL.DataType.UnsignedByte, false, 0, 0);
  }

  public draw(): void {
    const gl = System.instance.context;
    this.indices.bind(GL.Buffer.Target.ArrayBuffer);
    gl.drawArrays(GL.PrimitiveType.Points, 0, this.numIndices);
  }

  public static create(args: PolylineArgs): PointStringGeometry | undefined {
    assert(args.polylines.length === 1);
    const vertexIndices = VertexLUT.convertIndicesToTriplets(args.polylines[0].vertIndices);
    const indices = BufferHandle.createArrayBuffer(vertexIndices);
    if (undefined !== indices) {
      const lutParams: VertexLUT.Params = new VertexLUT.Params(new VertexLUT.SimpleBuilder(args), args.colors);
      const info = new PointStringInfo(args);
      const lut = lutParams.toData(info.vertexParams);
      if (undefined !== lut) {
        return new PointStringGeometry(indices, args.polylines[0].vertIndices.length, lut, info);
      }
    }
    return undefined;
  }
}

export class PointStringPrimitive extends Primitive {
  public static create(args: PolylineArgs, iModel: IModelConnection): PointStringPrimitive | undefined {
    const geom = PointStringGeometry.create(args);
    return undefined !== geom ? new PointStringPrimitive(geom, iModel) : undefined;
  }
  private constructor(cachedGeom: CachedGeometry, iModel: IModelConnection) { super(cachedGeom, iModel); }
  public get renderOrder(): RenderOrder { return RenderOrder.Linear; }
}

const computePosition = `
float lineWeight = ComputeLineWeight();
if (lineWeight > 4.0)
  lineWeight += 0.5; // ###TODO: Fudge factor for rounding fat points...

gl_PointSize = lineWeight;
return u_mvp * rawPos;`;

const roundCorners = `
// gl_PointSize specifies coordinates of this fragment within the point in range [0,1].
// This should be the most precise of the many approaches we've tried, but it still yields some asymmetry...
// Discarding if it meets radius precisely seems to reduce that slightly...
// ###TODO try point sprites?
const vec2 center = vec2(0.5, 0.5);
vec2 vt = gl_PointCoord - center;
return dot(vt, vt) * v_roundCorners >= 0.25; // meets or exceeds radius of circle
`;

const computeRoundCorners = "v_roundCorners = gl_PointSize > 4.0 ? 1.0 : 0.0;";

function createBase(clip: WithClipVolume): ProgramBuilder {
  const builder = new ProgramBuilder(true);
  // addShaderFlags(builder); // Commented out in the c++ code
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  vert.addFunction(GLSLVertex.computeLineWeight);
  vert.addUniform("u_lineWeight", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_lineWeight", (uniform, params) => {
      uniform.setUniform1f(params.geometry.getLineWeight(params));
    });
  });
  builder.addInlineComputedVarying("v_roundCorners", VariableType.Float, computeRoundCorners);
  builder.frag.set(FragmentShaderComponent.CheckForEarlyDiscard, roundCorners);

  if (WithClipVolume.Yes === clip)
    addClipping(builder);
  return builder;
}

export function createPointStringHiliter(clip: WithClipVolume): ProgramBuilder {
  const builder = createBase(clip);
  addHiliter(builder, true);
  return builder;
}

export function createPointStringBuilder(clip: WithClipVolume): ProgramBuilder {
  const builder = createBase(clip);
  addShaderFlags(builder);
  addColor(builder);
  addWhiteOnWhiteReversal(builder.frag);
  return builder;
}
