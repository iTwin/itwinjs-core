/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Range3d } from "@itwin/core-geometry";
import { Instance } from "../../render/RenderInstancesParams";
import { Feature, FeatureTable } from "@itwin/core-common";
import { InstancedGraphicProps } from "../../render/InstancedGraphicParams";
import { OvrFlags } from "./OvrFlags";
import { lineCodeFromLinePixels } from "./LineCode";

export class InstancedGraphicPropsBuilder {
  private readonly _instances: Instance[] = [];
  private readonly _transformRange = new Range3d();
  private _haveSymbology = false;
  
  public add(instance: Instance): void {
    this._instances.push(instance);
    this._transformRange.extendXYZ(instance.transform.origin.x, instance.transform.origin.y, instance.transform.origin.z);
    if (instance.symbology) {
      this._haveSymbology = true;
    }
  }

  public get length() { return this._instances.length; }

  public finish(featureTable: FeatureTable | undefined): InstancedGraphicProps | undefined {
    const count = this.length;
    if (0 === count) {
      return undefined;
    }

    const tfc = this._transformRange.center;
    const transformCenter = { x: tfc.x, y: tfc.y, z: tfc.z };

    const transforms = new Float32Array(count * 12);
    const featureIds = featureTable ? new Uint8Array(count * 3) : undefined;
    const symbologyOverrides = this._haveSymbology ? new Uint8Array(count * 8) : undefined;

    for (let i = 0; i < count; i++) {
      const instance = this._instances[i];
      if (featureIds) {
        const feature = typeof instance.feature === "string" ? new Feature(instance.feature) : instance.feature;
        const featureIndex = feature ? featureTable!.insert(feature) : 0;
        featureIds[i * 3 + 0] = featureIndex & 0xff;
        featureIds[i * 3 + 1] = (featureIndex & 0xff00) >> 8;
        featureIds[i * 3 + 2] = (featureIndex & 0xff0000) >> 16;
      }

      const symb = instance.symbology;
      if (symbologyOverrides && symb) {
        const ovrIdx = i * 8;
        let flags = OvrFlags.None;

        const weight = symb.weight;
        if (undefined !== weight) {
          symbologyOverrides[ovrIdx + 1] = Math.max(1, Math.min(31, weight));
          flags |= OvrFlags.Weight;
        }

        if (undefined !== symb.linePixels) {
          symbologyOverrides[ovrIdx + 2] = lineCodeFromLinePixels(symb.linePixels);
          flags |= OvrFlags.LineCode;
        }

        if (undefined !== symb.color) {
          symbologyOverrides[ovrIdx + 4] = Math.max(0, Math.min(symb.color.r, 255));
          symbologyOverrides[ovrIdx + 5] = Math.max(0, Math.min(symb.color.g, 255));
          symbologyOverrides[ovrIdx + 6] = Math.max(0, Math.min(symb.color.b, 255));
          flags |= OvrFlags.Rgb;
        }

        if (undefined !== symb.transparency) {
          const transp = Math.max(0, Math.min(255, symb.transparency));
          symbologyOverrides[ovrIdx + 7] = 255 - transp;
          flags |= OvrFlags.Alpha;
        }

        symbologyOverrides[ovrIdx] = flags;
      }

      const tf = instance.transform;
      tf.origin.subtractInPlace(transformCenter);
      const tfIdx = i * 12;

      transforms[tfIdx + 0] = tf.matrix.coffs[0];
      transforms[tfIdx + 1] = tf.matrix.coffs[1];
      transforms[tfIdx + 2] = tf.matrix.coffs[2];
      transforms[tfIdx + 3] = tf.origin.x;
      
      transforms[tfIdx + 4] = tf.matrix.coffs[3];
      transforms[tfIdx + 5] = tf.matrix.coffs[4];
      transforms[tfIdx + 6] = tf.matrix.coffs[5];
      transforms[tfIdx + 7] = tf.origin.y;

      transforms[tfIdx + 8] = tf.matrix.coffs[6];
      transforms[tfIdx + 9] = tf.matrix.coffs[7];
      transforms[tfIdx + 10] = tf.matrix.coffs[8];
      transforms[tfIdx + 11] = tf.origin.z;
    }

    return {
      count,
      transforms,
      transformCenter,
      featureIds,
      symbologyOverrides,
    };
  }
}

