/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { CurveExtendMode, CurveExtendOptions } from "../../curve/CurveExtendMode";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Checker } from "../Checker";

/* eslint-disable no-console */

describe("CurveExtendMode", () => {

  it("HelloWorld", () => {
    const ck = new Checker();
    ck.testExactNumber(CurveExtendMode.None, CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(false, 0));
    ck.testExactNumber(CurveExtendMode.OnCurve, CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(true, 0));
    ck.testExactNumber(CurveExtendMode.None, CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(CurveExtendMode.None, 0));
    ck.testExactNumber(CurveExtendMode.None, CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(CurveExtendMode.None, 1));

    ck.testExactNumber(CurveExtendMode.OnTangent, CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(CurveExtendMode.OnTangent, 0));
    ck.testExactNumber(CurveExtendMode.OnTangent, CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(CurveExtendMode.OnTangent, 1));

    const qTangentNone: [CurveExtendMode, CurveExtendMode] = [CurveExtendMode.OnTangent, CurveExtendMode.None];
    ck.testExactNumber(CurveExtendMode.OnTangent, CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(qTangentNone, 0));
    ck.testExactNumber(CurveExtendMode.None, CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(qTangentNone, 1));

    const qNoneTangent: [CurveExtendMode, CurveExtendMode] = [CurveExtendMode.None, CurveExtendMode.OnTangent];
    ck.testExactNumber(CurveExtendMode.None, CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(qNoneTangent, 0));
    ck.testExactNumber(CurveExtendMode.OnTangent, CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(qNoneTangent, 1));

    const sweep = AngleSweep.createStartEndDegrees(10, 70);
    const fractionPeriod = sweep.fractionPeriod();
    const extend1 = [CurveExtendMode.None, CurveExtendMode.OnCurve];
    const extend0 = [CurveExtendMode.OnCurve, CurveExtendMode.None];
    const extendBoth = [CurveExtendMode.OnCurve, CurveExtendMode.OnCurve];
    for (const fraction of [-0.1, 0.1, 0.9, 1.1]) {
      const radians = sweep.fractionToRadians(fraction);
      const fractionCap = CurveExtendOptions.resolveRadiansToSweepFraction(CurveExtendMode.None, radians, sweep);
      const fraction0 = CurveExtendOptions.resolveRadiansToSweepFraction(extend0, radians, sweep);
      const fraction1 = CurveExtendOptions.resolveRadiansToSweepFraction(extend1, radians, sweep);
      const fractionBoth = CurveExtendOptions.resolveRadiansToSweepFraction(extendBoth, radians, sweep);
      // ASSUME -- the test fractions all stay within their "near to end" region ...
      ck.testCoordinate(fraction, fractionBoth);
      if (fraction > 1.0) {
        ck.testCoordinate(1.0, fractionCap, "resolveRadians with cap");
        ck.testCoordinate(fraction, fraction1, "resolveRadians with sign");
        ck.testCoordinate(fraction1, fraction0 + fractionPeriod, "resolveRadians with sign");
      } else if (fraction < 0.0) {
        ck.testCoordinate(0.0, fractionCap, "resolveRadians with cap");
        ck.testCoordinate(fraction, fraction0, "resolveRadians with sign");
        ck.testCoordinate(fraction0, fraction1 - fractionPeriod, "resolveRadians with sign");
      } else {
        ck.testCoordinate(fraction, fractionCap, "resolveRadians with cap");
        ck.testCoordinate(fraction, fraction0, "resolveRadians with sign");
        ck.testCoordinate(fraction, fraction1, "resolveRadians with sign");
      }

      ck.testCoordinate(fraction, CurveExtendOptions.correctFraction(extendBoth, fraction), "unbounded");
      ck.testCoordinate(fraction > 1 ? 1 : fraction, CurveExtendOptions.correctFraction(extend0, fraction), "extend0");
      ck.testCoordinate(fraction < 0 ? 0 : fraction, CurveExtendOptions.correctFraction(extend1, fraction), "extend1");
    }

    expect(ck.getNumErrors()).equals(0);
  });
});
