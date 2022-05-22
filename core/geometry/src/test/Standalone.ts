/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

import { assert } from "chai";
import { Point3d } from "../geometry3d/Point3dVector3d";

// console.log("=========================");
// console.log("Standalone Output");
// console.log("=========================");

const point0 = Point3d.create(0, 0.001, 586);
const point1 = Point3d.create(5, 0, -192);

point1.setFrom(point0);

assert.isTrue(point0.isAlmostEqual(point1), "Points are expected to be equal");
