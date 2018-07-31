/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { NineZone, getDefaultProps } from "@src/zones/state/NineZone";

const defaultProps = getDefaultProps();

describe("NineZone", () => {
  it("should construct an instance", () => {
    new NineZone(defaultProps);
  });

  it("should throw if zone id is unknown", () => {
    const sut = new NineZone(defaultProps);
    (() => sut.getZone(0)).should.throw();
    (() => sut.getZone(10)).should.throw();
  });

  it("zones should have correct cells", () => {
    const sut = new NineZone(defaultProps);

    const zone1 = sut.getZone(1);
    zone1.getCell().row.should.eq(0);
    zone1.getCell().col.should.eq(0);

    const zone2 = sut.getZone(2);
    zone2.getCell().row.should.eq(0);
    zone2.getCell().col.should.eq(1);

    const zone3 = sut.getZone(3);
    zone3.getCell().row.should.eq(0);
    zone3.getCell().col.should.eq(2);

    const zone4 = sut.getZone(4);
    zone4.getCell().row.should.eq(1);
    zone4.getCell().col.should.eq(0);

    const zone6 = sut.getZone(6);
    zone6.getCell().row.should.eq(1);
    zone6.getCell().col.should.eq(2);

    const zone7 = sut.getZone(7);
    zone7.getCell().row.should.eq(2);
    zone7.getCell().col.should.eq(0);

    const zone8 = sut.getZone(8);
    zone8.getCell().row.should.eq(2);
    zone8.getCell().col.should.eq(1);

    const zone9 = sut.getZone(9);
    zone9.getCell().row.should.eq(2);
    zone9.getCell().col.should.eq(2);
  });
});
