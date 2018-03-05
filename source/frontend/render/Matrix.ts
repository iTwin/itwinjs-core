/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Vector3d, Point3d, RotMatrix, Transform, Matrix4d } from "@bentley/geometry-core";
import { assert } from "@bentley/bentleyjs-core";

export class Matrix3 {
    public data: Float32Array;
    constructor(m00: number, m01: number, m02: number, m10: number, m11: number, m12: number, m20: number, m21: number, m22: number) {
        const data = [];
        data[0] = m00;
        data[3] = m01;
        data[6] = m02;
        data[1] = m10;
        data[4] = m11;
        data[7] = m12;
        data[2] = m20;
        data[5] = m21;
        data[8] = m22;
        this.data = new Float32Array(data);
    }

    public toRotMatrix() {
        const data = this.data;
        return RotMatrix.createRowValues(data[0], data[3], data[6], data[1], data[4], data[7], data[2], data[5], data[8]);
    }

    public static fromRotMatrix(mat: RotMatrix): Matrix3 {
        return new Matrix3(mat.at(0, 0), mat.at(0, 1), mat.at(0, 2), mat.at(1, 0), mat.at(1, 1), mat.at(1, 2), mat.at(2, 0), mat.at(2, 1), mat.at(2, 2));
    }

    public static transpose(mat: Matrix3): Matrix3 {
        return new Matrix3(mat.data[0], mat.data[1], mat.data[2], mat.data[3], mat.data[4], mat.data[5], mat.data[6], mat.data[7], mat.data[8]);
    }
}

export class Matrix4 {
    public data: Float32Array;
    constructor(m00: number, m01: number, m02: number, m03: number, m10: number, m11: number, m12: number, m13: number, m20: number, m21: number, m22: number, m23: number, m30: number, m31: number, m32: number, m33: number) {
        const data = [];
        data[0] = m00;
        data[4] = m01;
        data[8] = m02;
        data[12] = m03;
        data[1] = m10;
        data[5] = m11;
        data[9] = m12;
        data[13] = m13;
        data[2] = m20;
        data[6] = m21;
        data[10] = m22;
        data[14] = m23;
        data[3] = m30;
        data[7] = m31;
        data[11] = m32;
        data[15] = m33;
        this.data = new Float32Array(data);
    }
    public static identity(): Matrix4 {
        return new Matrix4(1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0);
    }
    public getRotation(): Matrix3 {
        const data = this.data;
        return new Matrix3(data[0], data[4], data[8],
            data[1], data[5], data[9],
            data[2], data[6], data[10]);
    }
    public initFromTransform(transform: Transform): void {
        const mat = transform.matrix;
        const origin = transform.origin;
        this.data = new Matrix4(mat.at(0, 0), mat.at(0, 1), mat.at(0, 2), origin.x,
            mat.at(1, 0), mat.at(1, 1), mat.at(1, 2), origin.y,
            mat.at(2, 0), mat.at(2, 1), mat.at(2, 2), origin.z,
            0.0, 0.0, 0.0, 1.0).data;
    }
    public toTransform(): Transform {
        const data = this.data;
        assert(0.0 === data[3] && 0.0 === data[7] && 0.0 === data[11] && 1.0 === data[15]);
        const origin = new Point3d(data[12], data[13], data[14]);
        const rotMat = RotMatrix.createIdentity();
        for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++)
                rotMat.setAt(i, j, data[i + j * 4]);
        return Transform.createRefs(origin, rotMat);
    }
    public static fromMatrix4d(mat: Matrix4d): Matrix4 {
        return new Matrix4(mat.atIJ(0, 0), mat.atIJ(0, 1), mat.atIJ(0, 2), mat.atIJ(0, 3),
            mat.atIJ(1, 0), mat.atIJ(1, 1), mat.atIJ(1, 2), mat.atIJ(1, 3),
            mat.atIJ(2, 0), mat.atIJ(2, 1), mat.atIJ(2, 2), mat.atIJ(2, 3),
            mat.atIJ(3, 0), mat.atIJ(3, 1), mat.atIJ(3, 2), mat.atIJ(3, 3));
    }
    public toMatrix4d(): Matrix4d {
        const data = this.data;
        return Matrix4d.createRowValues(data[0], data[4], data[8], data[12], data[1], data[5], data[9], data[13], data[2], data[6], data[10], data[14], data[3], data[7], data[11], data[15]);
    }
    public static lookAt(eye: Point3d, center: Point3d, up: Vector3d): Matrix4 | undefined {
        // From "\glm-0.9.8.3\glm\gtc\matrix_transform.inl"
        const f = normalizedDifference(center, eye);
        if (!f) return;
        const s = fromNormalizedCrossProduct(f, up);
        if (!s) return;
        const u = Vector3d.createCrossProduct(s.x, s.y, s.z, f.x, f.y, f.z);
        return new Matrix4(s.x, s.y, s.z, -s.dotProduct(eye), u.x, u.y, u.z, -u.dotProduct(eye), -f.x, -f.y, -f.z, f.dotProduct(eye), 0, 0, 0, 1);
    }
    // left, right, bottom, top, near, far
    public static frustum(l: number, r: number, b: number, t: number, n: number, f: number) {
        return new Matrix4((2 * n) / (r - l), 0, (r + l) / (r - l), 0, 0, (2 * n) / (t - b),
            (t + b) / (t - b), 0, 0, 0, -(f + n) / (f - n),
            -(2 * f * n) / (f - n), 0, 0, -1, 0);
    }
    public static perspective(fovY: number, aspectRatio: number, nearZ: number, farZ: number) {
        const frustumHeight = Math.tan(fovY / 360 * Math.PI) * nearZ;
        const frustumWidth = frustumHeight * aspectRatio;
        return Matrix4.frustum(-frustumWidth, frustumWidth, -frustumHeight, frustumHeight, nearZ, farZ);
    }
    public static ortho(l: number, r: number, b: number, t: number, n: number, f: number) {
        return new Matrix4(2 / (r - l), 0, 0, -(r + l) / (r - l), 0, 2 / (t - b), 0,
            -(t + b) / (t - b), 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0,
            0, 1);
    }
    public static invert(mat: Matrix4) {
        let inverted = new Matrix4(
            mat.data[5] * mat.data[10] * mat.data[15] - mat.data[5] * mat.data[11] * mat.data[14] -
            mat.data[9] * mat.data[6] * mat.data[15] + mat.data[9] * mat.data[7] * mat.data[14] +
            mat.data[13] * mat.data[6] * mat.data[11] - mat.data[13] * mat.data[7] * mat.data[10],
            -mat.data[4] * mat.data[10] * mat.data[15] + mat.data[4] * mat.data[11] * mat.data[14] +
            mat.data[8] * mat.data[6] * mat.data[15] - mat.data[8] * mat.data[7] * mat.data[14] -
            mat.data[12] * mat.data[6] * mat.data[11] + mat.data[12] * mat.data[7] * mat.data[10],
            mat.data[4] * mat.data[9] * mat.data[15] - mat.data[4] * mat.data[11] * mat.data[13] -
            mat.data[8] * mat.data[5] * mat.data[15] + mat.data[8] * mat.data[7] * mat.data[13] +
            mat.data[12] * mat.data[5] * mat.data[11] - mat.data[12] * mat.data[7] * mat.data[9],
            -mat.data[4] * mat.data[9] * mat.data[14] + mat.data[4] * mat.data[10] * mat.data[13] +
            mat.data[8] * mat.data[5] * mat.data[14] - mat.data[8] * mat.data[6] * mat.data[13] -
            mat.data[12] * mat.data[5] * mat.data[10] + mat.data[12] * mat.data[6] * mat.data[9],
            -mat.data[1] * mat.data[10] * mat.data[15] + mat.data[1] * mat.data[11] * mat.data[14] +
            mat.data[9] * mat.data[2] * mat.data[15] - mat.data[9] * mat.data[3] * mat.data[14] -
            mat.data[13] * mat.data[2] * mat.data[11] + mat.data[13] * mat.data[3] * mat.data[10],
            mat.data[0] * mat.data[10] * mat.data[15] - mat.data[0] * mat.data[11] * mat.data[14] -
            mat.data[8] * mat.data[2] * mat.data[15] + mat.data[8] * mat.data[3] * mat.data[14] +
            mat.data[12] * mat.data[2] * mat.data[11] - mat.data[12] * mat.data[3] * mat.data[10],
            -mat.data[0] * mat.data[9] * mat.data[15] + mat.data[0] * mat.data[11] * mat.data[13] +
            mat.data[8] * mat.data[1] * mat.data[15] - mat.data[8] * mat.data[3] * mat.data[13] -
            mat.data[12] * mat.data[1] * mat.data[11] + mat.data[12] * mat.data[3] * mat.data[9],
            mat.data[0] * mat.data[9] * mat.data[14] - mat.data[0] * mat.data[10] * mat.data[13] -
            mat.data[8] * mat.data[1] * mat.data[14] + mat.data[8] * mat.data[2] * mat.data[13] +
            mat.data[12] * mat.data[1] * mat.data[10] - mat.data[12] * mat.data[2] * mat.data[9],
            mat.data[1] * mat.data[6] * mat.data[15] - mat.data[1] * mat.data[7] * mat.data[14] -
            mat.data[5] * mat.data[2] * mat.data[15] + mat.data[5] * mat.data[3] * mat.data[14] +
            mat.data[13] * mat.data[2] * mat.data[7] - mat.data[13] * mat.data[3] * mat.data[6],
            -mat.data[0] * mat.data[6] * mat.data[15] + mat.data[0] * mat.data[7] * mat.data[14] +
            mat.data[4] * mat.data[2] * mat.data[15] - mat.data[4] * mat.data[3] * mat.data[14] -
            mat.data[12] * mat.data[2] * mat.data[7] + mat.data[12] * mat.data[3] * mat.data[6],
            mat.data[0] * mat.data[5] * mat.data[15] - mat.data[0] * mat.data[7] * mat.data[13] -
            mat.data[4] * mat.data[1] * mat.data[15] + mat.data[4] * mat.data[3] * mat.data[13] +
            mat.data[12] * mat.data[1] * mat.data[7] - mat.data[12] * mat.data[3] * mat.data[5],
            -mat.data[0] * mat.data[5] * mat.data[14] + mat.data[0] * mat.data[6] * mat.data[13] +
            mat.data[4] * mat.data[1] * mat.data[14] - mat.data[4] * mat.data[2] * mat.data[13] -
            mat.data[12] * mat.data[1] * mat.data[6] + mat.data[12] * mat.data[2] * mat.data[5],
            -mat.data[1] * mat.data[6] * mat.data[11] + mat.data[1] * mat.data[7] * mat.data[10] +
            mat.data[5] * mat.data[2] * mat.data[11] - mat.data[5] * mat.data[3] * mat.data[10] -
            mat.data[9] * mat.data[2] * mat.data[7] + mat.data[9] * mat.data[3] * mat.data[6],
            mat.data[0] * mat.data[6] * mat.data[11] - mat.data[0] * mat.data[7] * mat.data[10] -
            mat.data[4] * mat.data[2] * mat.data[11] + mat.data[4] * mat.data[3] * mat.data[10] +
            mat.data[8] * mat.data[2] * mat.data[7] - mat.data[8] * mat.data[3] * mat.data[6],
            -mat.data[0] * mat.data[5] * mat.data[11] + mat.data[0] * mat.data[7] * mat.data[9] +
            mat.data[4] * mat.data[1] * mat.data[11] - mat.data[4] * mat.data[3] * mat.data[9] -
            mat.data[8] * mat.data[1] * mat.data[7] + mat.data[8] * mat.data[3] * mat.data[5],
            mat.data[0] * mat.data[5] * mat.data[10] - mat.data[0] * mat.data[6] * mat.data[9] -
            mat.data[4] * mat.data[1] * mat.data[10] + mat.data[4] * mat.data[2] * mat.data[9] +
            mat.data[8] * mat.data[1] * mat.data[6] - mat.data[8] * mat.data[2] * mat.data[5]);

        const determinant = mat.data[0] * inverted.data[0] + mat.data[1] * inverted.data[4] +
            mat.data[2] * inverted.data[8] + mat.data[3] * inverted.data[12];

        if (determinant !== 0) inverted.multiplyByScalar(1 / determinant);
        else inverted = Matrix4.identity();

        return inverted;
    }
    public static transpose(mat: Matrix4): Matrix4 {
        return new Matrix4(mat.data[0], mat.data[1], mat.data[2], mat.data[3], mat.data[4], mat.data[5],
            mat.data[6], mat.data[7], mat.data[8], mat.data[9], mat.data[10], mat.data[11],
            mat.data[12], mat.data[13], mat.data[14], mat.data[15]);
    }
    public multiply(b: Matrix4) {
        const a = this;
        return new Matrix4(a.data[0] * b.data[0] + a.data[4] * b.data[1] + a.data[8] * b.data[2] +
            a.data[12] * b.data[3],
            a.data[0] * b.data[4] + a.data[4] * b.data[5] + a.data[8] * b.data[6] +
            a.data[12] * b.data[7],
            a.data[0] * b.data[8] + a.data[4] * b.data[9] + a.data[8] * b.data[10] +
            a.data[12] * b.data[11],
            a.data[0] * b.data[12] + a.data[4] * b.data[13] + a.data[8] * b.data[14] +
            a.data[12] * b.data[15],
            a.data[1] * b.data[0] + a.data[5] * b.data[1] + a.data[9] * b.data[2] +
            a.data[13] * b.data[3],
            a.data[1] * b.data[4] + a.data[5] * b.data[5] + a.data[9] * b.data[6] +
            a.data[13] * b.data[7],
            a.data[1] * b.data[8] + a.data[5] * b.data[9] + a.data[9] * b.data[10] +
            a.data[13] * b.data[11],
            a.data[1] * b.data[12] + a.data[5] * b.data[13] + a.data[9] * b.data[14] +
            a.data[13] * b.data[15],
            a.data[2] * b.data[0] + a.data[6] * b.data[1] + a.data[10] * b.data[2] +
            a.data[14] * b.data[3],
            a.data[2] * b.data[4] + a.data[6] * b.data[5] + a.data[10] * b.data[6] +
            a.data[14] * b.data[7],
            a.data[2] * b.data[8] + a.data[6] * b.data[9] + a.data[10] * b.data[10] +
            a.data[14] * b.data[11],
            a.data[2] * b.data[12] + a.data[6] * b.data[13] + a.data[10] * b.data[14] +
            a.data[14] * b.data[15],
            a.data[3] * b.data[0] + a.data[7] * b.data[1] + a.data[11] * b.data[2] +
            a.data[15] * b.data[3],
            a.data[3] * b.data[4] + a.data[7] * b.data[5] + a.data[11] * b.data[6] +
            a.data[15] * b.data[7],
            a.data[3] * b.data[8] + a.data[7] * b.data[9] + a.data[11] * b.data[10] +
            a.data[15] * b.data[11],
            a.data[3] * b.data[12] + a.data[7] * b.data[13] + a.data[11] * b.data[14] +
            a.data[15] * b.data[15]);
    }
    public multiplyByScalar(scalar: number) {
        this.data = this.data.map((x) => x * scalar);
    }
}

// missing Vector3d functions

export function fromNormalizedCrossProduct(vec0: Vector3d, vec1: Vector3d): Vector3d | undefined {
    return vec0.unitCrossProduct(vec1);
}

export function normalizedDifference(target: Point3d, origin: Point3d): Vector3d | undefined {
    return Vector3d.createStartEnd(origin, target).normalize();
}
