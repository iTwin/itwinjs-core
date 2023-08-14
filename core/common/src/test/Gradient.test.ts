/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Angle } from "@itwin/core-geometry";
import { Gradient } from "../Gradient";
import { ImageBuffer, ImageBufferFormat } from "../Image";

describe("Gradient.Symb", () => {
  it("should round-trip through JSON", () => {
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

    symbArr.sort((lhs, rhs) => Gradient.Symb.compareSymb(lhs, rhs));

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

  function getPixel(img: ImageBuffer, x: number, y: number): number {
    expect(img.format).to.equal(ImageBufferFormat.Rgba);
    expect(img.data.byteLength).to.equal(img.width * img.height * 4);

    const data = new Uint32Array(img.data.buffer);
    const index = x + y * img.width;
    return data[index];
  }

  describe("getImage", () => {
    it("produces an image of the specified dimensions", () => {
      const symb = Gradient.Symb.fromJSON({
        mode: Gradient.Mode.Linear,
        keys: [{ value: .65, color: 100 }, { value: .12, color: 100 }],
      });

      const img = symb.getImage(123, 456);
      expect(img.width).to.equal(123);
      expect(img.height).to.equal(456);
    });

    it("constraints width of thematic image to 1", () => {
      const symb = Gradient.Symb.fromJSON({
        mode: Gradient.Mode.Thematic,
        keys: [{ value: .65, color: 100 }, { value: .12, color: 100 }],
      });

      const img = symb.getImage(123, 456);
      expect(img.width).to.equal(1);
      expect(img.height).to.equal(456);
    });

    it("includes thematic margin color", () => {
      const symb = Gradient.Symb.fromJSON({
        mode: Gradient.Mode.Thematic,
        keys: [{ value: .65, color: 100 }, { value: .12, color: 100 }],
        thematicSettings: { marginColor: 0x00ff00 },
      });

      const img = symb.getImage(1, 8192);
      expect(getPixel(img, 0, 8191)).to.equal(0xff00ff00);
      expect(getPixel(img, 0, 127)).not.to.equal(0xff00ff00);
      expect(getPixel(img, 0, 0)).to.equal(0xff00ff00);
    });
  });

  describe("produceImage", () => {
    it("produces an image of the specified dimensions", () => {
      const symb = Gradient.Symb.fromJSON({
        mode: Gradient.Mode.Linear,
        keys: [{ value: .65, color: 100 }, { value: .12, color: 100 }],
      });

      const img = symb.produceImage({ width: 123, height: 456 });
      expect(img.width).to.equal(123);
      expect(img.height).to.equal(456);
    });

    it("does not constrain dimensions of thematic images", () => {
      const symb = Gradient.Symb.fromJSON({
        mode: Gradient.Mode.Thematic,
        keys: [{ value: .65, color: 100 }, { value: .12, color: 100 }],
      });

      const img = symb.produceImage({ width: 123, height: 456 });
      expect(img.width).to.equal(123);
      expect(img.height).to.equal(456);
    });

    it("allows thematic margin color to be included or omitted", () => {
      const symb = Gradient.Symb.fromJSON({
        mode: Gradient.Mode.Thematic,
        keys: [{ value: .65, color: 100 }, { value: .12, color: 100 }],
        thematicSettings: { marginColor: 0x00ff00 },
      });

      let img = symb.produceImage({ width: 1, height: 8192, includeThematicMargin: true });
      expect(getPixel(img, 0, 8191)).to.equal(0xff00ff00);
      expect(getPixel(img, 0, 127)).not.to.equal(0xff00ff00);
      expect(getPixel(img, 0, 0)).to.equal(0xff00ff00);

      img = symb.produceImage({ width: 1, height: 8192, includeThematicMargin: false });
      expect(getPixel(img, 0, 8191)).not.to.equal(0xff00ff00);
      expect(getPixel(img, 0, 127)).not.to.equal(0xff00ff00);
      expect(getPixel(img, 0, 0)).not.to.equal(0xff00ff00);

      img = symb.produceImage({ width: 1, height: 8192 });
      expect(getPixel(img, 0, 8191)).not.to.equal(0xff00ff00);
      expect(getPixel(img, 0, 127)).not.to.equal(0xff00ff00);
      expect(getPixel(img, 0, 0)).not.to.equal(0xff00ff00);
    });
  });
});
