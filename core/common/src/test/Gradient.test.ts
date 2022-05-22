/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Angle } from "@itwin/core-geometry";
import { Gradient } from "../Gradient";

describe("Gradient.Symb", () => {
  it("should round=-trip through JSON", () => {
    let symb = Gradient.Symb.fromJSON({
      mode: Gradient.Mode.Linear,
      flags: Gradient.Flags.Outline,
      angle: Angle.createDegrees(45.5),
      tint: 0.6,
      shift: 1,
      keys: [{ value: .65, color: 100 }, { value: .12, color: 100 }],
    });

    const symbCopy = symb.clone();
    assert.isTrue(symb.equals(symbCopy));

    // Assert that ordering of symbology is correct using implemented compare method
    const symbArr: Gradient.Symb[] = [];
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.731472008309797, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.731472008309797, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 610 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 0,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.731472008309797, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 2,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.731472008309797, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.02,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.731472008309797, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.6,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.731472008309797, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 2,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.731472008309797, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 5.576,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.731472008309797, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(20.6),
      keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.731472008309797, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(122),
      keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.731472008309797, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.333, color: 610 }, { value: 0.731472008309797, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.78, color: 610 }, { value: 0.731472008309797, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 425 }, { value: 0.731472008309797, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 611 }, { value: 0.731472008309797, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.6767, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.8787, color: 230 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.731472008309797, color: 231 }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.731472008309797, color: 229 }],
    });
    symbArr.push(symb);

    symbArr.sort(Gradient.Symb.compareSymb);

    for (let i = 1; i < symbArr.length; i++) {
      const prev = symbArr[i - 1];
      const current = symbArr[i];
      if (current.mode !== prev.mode) {
        assert.isTrue(current.mode > prev.mode);
        continue;
      }
      if (current.flags !== prev.flags) {
        assert.isTrue(current.flags > prev.flags);
        continue;
      }
      if (current.tint !== prev.tint) {
        assert.isTrue(current.tint! > prev.tint!);
        continue;
      }
      if (current.shift !== prev.shift) {
        assert.isTrue(current.shift > prev.shift);
        continue;
      }
      if (current.angle!.degrees !== prev.angle!.degrees) {
        assert.isTrue(current.angle!.degrees > prev.angle!.degrees);
        continue;
      }
      if (current.keys.length !== prev.keys.length) {
        assert.isTrue(current.keys.length > prev.keys.length);
        continue;
      }
      if (current.keys[0].value !== prev.keys[0].value) {
        assert.isTrue(current.keys[0].value > prev.keys[0].value);
        continue;
      }
      if (current.keys[0].color.tbgr !== prev.keys[0].color.tbgr) {
        assert.isTrue(current.keys[0].color.tbgr > prev.keys[0].color.tbgr);
        continue;
      }
      if (current.keys[1].value !== prev.keys[1].value) {
        assert.isTrue(current.keys[1].value > prev.keys[1].value);
        continue;
      }
      if (current.keys[1].color.tbgr !== prev.keys[1].color.tbgr) {
        assert.isTrue(current.keys[1].color.tbgr > prev.keys[1].color.tbgr);
        continue;
      }
      assert.isTrue(current.equals(prev));
    }
  });
});
