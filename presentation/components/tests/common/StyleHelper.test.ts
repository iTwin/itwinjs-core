/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { Node } from "@bentley/presentation-common";
import { createRandomECInstanceNodeKey } from "@bentley/presentation-common/tests/_helpers/random";
import StyleHelper from "../../lib/common/StyleHelper";

describe("StyleHelper", () => {

    const createNodeBase = (): Node => ({
        label: faker.random.word(),
        key: createRandomECInstanceNodeKey(),
    });

    describe("isBold", () => {

        it("returns true when fontStyle property contains 'Bold'", () => {
            const node = { ...createNodeBase(), fontStyle: "*** Bold***" };
            expect(StyleHelper.isBold(node)).to.be.true;
        });

        it("returns false when fontStyle property doesn't contain 'Bold'", () => {
            const node = { ...createNodeBase(), fontStyle: "Test" };
            expect(StyleHelper.isBold(node)).to.be.false;
        });

    });

    describe("isItalic", () => {

        it("returns true when fontStyle property contains 'Italic'", () => {
            const node = { ...createNodeBase(), fontStyle: "*** Italic***" };
            expect(StyleHelper.isItalic(node)).to.be.true;
        });

        it("returns false when fontStyle property doesn't contain 'Italic'", () => {
            const node = { ...createNodeBase(), fontStyle: "Test" };
            expect(StyleHelper.isItalic(node)).to.be.false;
        });

    });

    describe("getColor", () => {

        describe("from RGB", () => {

            it("returns valid color", () => {
                const node = { ...createNodeBase(), backColor: "rgb(1, 1,1 )" };
                expect(StyleHelper.getBackColor(node)).to.eq(0x010101ff);
            });

        });

        describe("from hex", () => {

            it("returns valid color", () => {
                const node = { ...createNodeBase(), backColor: "#010101" };
                expect(StyleHelper.getBackColor(node)).to.eq(0x010101ff);
            });

        });

        describe("from color name", () => {

            it("returns valid color", () => {
                const colorName = faker.random.arrayElement(Object.keys(StyleHelper.availableColors));
                const color = StyleHelper.availableColors[colorName];
                const node = { ...createNodeBase(), backColor: colorName };
                expect(StyleHelper.getBackColor(node)).to.eq(color);
            });

            it("throws on invalid color", () => {
                const node = { ...createNodeBase(), backColor: "does not exist" };
                expect(() => StyleHelper.getBackColor(node)).to.throw();
            });

        });

    });

});
