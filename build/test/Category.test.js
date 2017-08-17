"use strict";
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const Category_1 = require("../Category");
const IModel_1 = require("../IModel");
const Render_1 = require("../Render");
const BisCore_1 = require("../BisCore");
// First, register any domains that will be used in the tests.
BisCore_1.BisCore.registerSchema();
describe("Category tests", () => {
    it("Appearance should construct properly", () => {
        const opts = {
            color: Render_1.ColorDef.blue(),
            weight: 3,
            priority: 4,
            transp: 6,
            style: new IModel_1.Id("0x22"),
            material: new IModel_1.Id("0x24"),
            dontPlot: true,
            dontLocate: true,
            dontSnap: true,
            invisible: true,
        };
        let a1 = new Category_1.Appearance({});
        chai_1.assert.isFalse(a1.dontLocate);
        chai_1.assert.isFalse(a1.dontPlot);
        chai_1.assert.isFalse(a1.dontSnap);
        chai_1.assert.isFalse(a1.invisible);
        chai_1.assert.equal(a1.weight, 0);
        chai_1.assert.equal(a1.transparency, 0);
        chai_1.assert.equal(a1.priority, 0);
        chai_1.assert.isTrue(a1.color.equals(Render_1.ColorDef.black()));
        a1 = new Category_1.Appearance();
        chai_1.assert.isFalse(a1.dontLocate);
        chai_1.assert.isFalse(a1.dontPlot);
        chai_1.assert.isFalse(a1.dontSnap);
        chai_1.assert.isFalse(a1.invisible);
        chai_1.assert.equal(a1.weight, 0);
        chai_1.assert.equal(a1.transparency, 0);
        chai_1.assert.equal(a1.priority, 0);
        chai_1.assert.isTrue(a1.color.equals(Render_1.ColorDef.black()));
        a1 = new Category_1.Appearance(opts);
        chai_1.assert.isTrue(a1.dontPlot);
        chai_1.assert.isTrue(a1.dontLocate);
        chai_1.assert.isTrue(a1.dontSnap);
        chai_1.assert.isTrue(a1.invisible);
        chai_1.assert.equal(a1.weight, 3);
        chai_1.assert.equal(a1.transparency, 6);
        chai_1.assert.equal(a1.priority, 4);
        chai_1.assert.isTrue(a1.color.equals(Render_1.ColorDef.blue()));
        let json = JSON.stringify(a1);
        const a2 = new Category_1.Appearance(JSON.parse(json));
        chai_1.assert.isTrue(a1.equals(a2));
        const o1 = new Category_1.SubCategoryOverride();
        o1.setColor(Render_1.ColorDef.darkBlue());
        o1.setDisplayPriority(33);
        o1.setWeight(13);
        o1.setTransparency(133);
        o1.setInvisible(true);
        o1.setMaterial(new IModel_1.Id("0x222"));
        o1.setStyle(new IModel_1.Id("0x2"));
        o1.applyTo(a2);
        chai_1.assert.isTrue(a2.color.equals(Render_1.ColorDef.darkBlue()));
        chai_1.assert.isTrue(a2.invisible);
        chai_1.assert.equal(a2.weight, 13);
        chai_1.assert.equal(a2.transparency, 133);
        chai_1.assert.equal(a2.priority, 33);
        chai_1.assert.isTrue(a2.styleId.equals(new IModel_1.Id("0x2")));
        chai_1.assert.isTrue(a2.materialId.equals(new IModel_1.Id("0x222")));
        o1.setColor(Render_1.ColorDef.darkRed());
        chai_1.assert.isTrue(a2.color.equals(Render_1.ColorDef.darkBlue()));
        json = JSON.stringify(o1);
        const o2 = Category_1.SubCategoryOverride.fromJSON(JSON.parse(json));
        chai_1.assert.deepEqual(o2, o1);
    });
});
