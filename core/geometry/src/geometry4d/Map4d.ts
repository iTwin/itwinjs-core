import { BeJSONFunctions } from "../Geometry";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Matrix4d } from "./Matrix4d";
/** Map4 carries two Matrix4d which are inverses of each other.
 */
export class Map4d implements BeJSONFunctions {
  private _matrix0: Matrix4d;
  private _matrix1: Matrix4d;
  private constructor(matrix0: Matrix4d, matrix1: Matrix4d) {
    this._matrix0 = matrix0;
    this._matrix1 = matrix1;
  }
  /** @returns Return a reference to (not copy of) the "forward" Matrix4d */
  public get transform0(): Matrix4d { return this._matrix0; }
  /** @returns Return a reference to (not copy of) the "reverse" Matrix4d */
  public get transform1(): Matrix4d { return this._matrix1; }
  /** Create a Map4d, capturing the references to the two matrices. */
  public static createRefs(matrix0: Matrix4d, matrix1: Matrix4d) {
    return new Map4d(matrix0, matrix1);
  }
  /** Create an identity map. */
  public static createIdentity(): Map4d { return new Map4d(Matrix4d.createIdentity(), Matrix4d.createIdentity()); }
  /** Create a Map4d with given transform pair.
   * @returns undefined if the transforms are not inverses of each other.
   */
  public static createTransform(transform0: Transform, transform1: Transform): Map4d | undefined {
    const product = transform0.multiplyTransformTransform(transform1);
    if (!product.isIdentity)
      return undefined;
    return new Map4d(Matrix4d.createTransform(transform0), Matrix4d.createTransform(transform1));
  }
  /**
   * Create a mapping the scales and translates (no rotation) between boxes.
   * @param lowA low point of box A
   * @param highA high point of box A
   * @param lowB low point of box B
   * @param highB high point of box B
   */
  public static createBoxMap(lowA: Point3d, highA: Point3d, lowB: Point3d, highB: Point3d, result?: Map4d): Map4d | undefined {
    const t0 = Matrix4d.createBoxToBox(lowA, highA, lowB, highB, result ? result.transform0 : undefined);
    const t1 = Matrix4d.createBoxToBox(lowB, highB, lowA, highA, result ? result.transform1 : undefined);
    if (t0 && t1) {
      if (result)
        return result;
      return new Map4d(t0, t1);
    }
    return undefined;
  }
  /** Copy contents from another Map4d */
  public setFrom(other: Map4d) { this._matrix0.setFrom(other._matrix0), this._matrix1.setFrom(other._matrix1); }
  /** @returns Return a clone of this Map4d */
  public clone(): Map4d { return new Map4d(this._matrix0.clone(), this._matrix1.clone()); }
  /** Reinitialize this Map4d as an identity. */
  public setIdentity() { this._matrix0.setIdentity(); this._matrix1.setIdentity(); }
  /** Set this map4d from a json object that the two Matrix4d values as properties named matrix0 and matrix1 */
  public setFromJSON(json: any): void {
    if (json.matrix0 && json.matrix1) {
      this._matrix0.setFromJSON(json.matrix0);
      this._matrix1.setFromJSON(json.matrix1);
    } else
      this.setIdentity();
  }
  /** Create a map4d from a json object that the two Matrix4d values as properties named matrix0 and matrix1 */
  public static fromJSON(json?: any): Map4d {
    const result = new Map4d(Matrix4d.createIdentity(), Matrix4d.createIdentity());
    result.setFromJSON(json);
    return result;
  }
  /** @returns a json object `{matrix0: value0, matrix1: value1}` */
  public toJSON(): any { return { matrix0: this._matrix0.toJSON(), matrix1: this._matrix1.toJSON() }; }
  public isAlmostEqual(other: Map4d) {
    return this._matrix0.isAlmostEqual(other._matrix0) && this._matrix1.isAlmostEqual(other._matrix1);
  }
  /** Create a map between a frustum and world coordinates.
   * @param origin lower left of frustum
   * @param uVector Vector from lower left rear to lower right rear
   * @param vVector Vector from lower left rear to upper left rear
   * @param wVector Vector from lower left rear to lower left front, i.e. lower left rear towards eye.
   * @param fraction front size divided by rear size.
   */
  public static createVectorFrustum(origin: Point3d, uVector: Vector3d, vVector: Vector3d, wVector: Vector3d, fraction: number): Map4d | undefined {
    fraction = Math.max(fraction, 1.0e-8);
    const slabToWorld = Transform.createOriginAndMatrix(origin, Matrix3d.createColumns(uVector, vVector, wVector));
    const worldToSlab = slabToWorld.inverse();
    if (!worldToSlab)
      return undefined;
    const worldToSlabMap = new Map4d(Matrix4d.createTransform(worldToSlab), Matrix4d.createTransform(slabToWorld));
    const slabToNPCMap = new Map4d(Matrix4d.createRowValues(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, fraction, 0, 0, 0, fraction - 1.0, 1), Matrix4d.createRowValues(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1.0 / fraction, 0, 0, 0, (1.0 - fraction) / fraction, 1));
    const result = slabToNPCMap.multiplyMapMap(worldToSlabMap);
    /*
    let numIdentity = 0;
    const productA = worldToSlabMap.matrix0.multiplyMatrixMatrix(worldToSlabMap.matrix1);
    if (productA.isIdentity())
      numIdentity++;
    const productB = slabToNPCMap.matrix0.multiplyMatrixMatrix(slabToNPCMap.matrix1);
    if (productB.isIdentity())
      numIdentity++;
    const product = result.matrix0.multiplyMatrixMatrix(result.matrix1);
    if (product.isIdentity())
      numIdentity++;
    if (numIdentity === 3)
        return result;
      */
    return result;
  }
  public multiplyMapMap(other: Map4d): Map4d {
    return new Map4d(this._matrix0.multiplyMatrixMatrix(other._matrix0), other._matrix1.multiplyMatrixMatrix(this._matrix1));
  }
  public reverseInPlace() {
    const temp = this._matrix0;
    this._matrix0 = this._matrix1;
    this._matrix1 = temp;
  }
  /** return a Map4d whose transform0 is
   * other.transform0 * this.transform0 * other.transform1
   */
  public sandwich0This1(other: Map4d): Map4d {
    return new Map4d(other._matrix0.multiplyMatrixMatrix(this._matrix0.multiplyMatrixMatrix(other._matrix1)), other._matrix0.multiplyMatrixMatrix(this._matrix1.multiplyMatrixMatrix(other._matrix1)));
  }
  /** return a Map4d whose transform0 is
   * other.transform1 * this.transform0 * other.transform0
   */
  public sandwich1This0(other: Map4d): Map4d {
    return new Map4d(other._matrix1.multiplyMatrixMatrix(this._matrix0.multiplyMatrixMatrix(other._matrix0)), other._matrix1.multiplyMatrixMatrix(this._matrix1.multiplyMatrixMatrix(other._matrix0)));
  }
} // Map4d
