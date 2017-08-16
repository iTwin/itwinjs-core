"use strict";
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const Render_1 = require("../Render");
const Lighting_1 = require("../Lighting");
const BisCore_1 = require("../BisCore");
// First, register any domains that will be used in the tests.
BisCore_1.BisCore.registerSchema();
describe("Render", () => {
    it("ViewFlags", () => {
        const flags = new Render_1.ViewFlags();
        chai_1.assert(flags.acsTriad === false);
        chai_1.assert(flags.grid === false);
        chai_1.assert(flags.fill === true);
        chai_1.assert(flags.renderMode === Render_1.RenderMode.Wireframe);
        flags.renderMode = Render_1.RenderMode.SmoothShade;
        flags.monochrome = true;
        const jsonstr = JSON.stringify(flags);
        const flags2 = Render_1.ViewFlags.fromJSON(JSON.parse(jsonstr));
        chai_1.assert(flags.acsTriad === flags2.acsTriad);
        chai_1.assert(flags.renderMode === flags2.renderMode);
        chai_1.assert(flags.monochrome === flags2.monochrome);
    });
    it("Lights", () => {
        const opts = {
            lightType: Lighting_1.LightType.Ambient,
            intensity: 10,
            color: Render_1.ColorDef.white(),
            kelvin: 100,
            shadows: 1,
            bulbs: 3,
            lumens: 2700,
        };
        const l1 = new Lighting_1.Light(opts);
        chai_1.assert.equal(l1.lightType, Lighting_1.LightType.Ambient);
        chai_1.assert.equal(l1.intensity, 10);
        chai_1.assert.isTrue(l1.color.equals(Render_1.ColorDef.white()));
        chai_1.assert.equal(l1.kelvin, 100);
        chai_1.assert.equal(l1.shadows, 1);
        chai_1.assert.equal(l1.bulbs, 3);
        chai_1.assert.equal(l1.lumens, 2700);
        const spotOpts = {
            intensity: 10,
            intensity2: 40,
            color: Render_1.ColorDef.white(),
            color2: 333,
            kelvin: 100,
            shadows: 1,
            bulbs: 3,
            lumens: 2700,
            inner: { radians: 1.5 },
            outer: 45.0,
        };
        const s1 = new Lighting_1.Spot(spotOpts);
        chai_1.assert.equal(s1.lightType, Lighting_1.LightType.Spot, "type");
        chai_1.assert.equal(s1.intensity, 10);
        chai_1.assert.equal(s1.kelvin, 100);
        chai_1.assert.equal(s1.shadows, 1);
        chai_1.assert.equal(s1.bulbs, 3);
        chai_1.assert.equal(s1.lumens, 2700);
        chai_1.assert.approximately(s1.inner.radians, 1.5, .001);
        chai_1.assert.approximately(s1.outer.degrees, 45.0, .001);
        chai_1.assert.isTrue(s1.color.equals(Render_1.ColorDef.white()));
        chai_1.assert.equal(s1.color2.rgba, 333);
        let json = JSON.stringify(l1);
        const l2 = new Lighting_1.Light(JSON.parse(json));
        chai_1.assert.deepEqual(l1, l2);
        json = JSON.stringify(s1);
        const s2 = new Lighting_1.Spot(JSON.parse(json));
        chai_1.assert.deepEqual(s1, s2);
    });
});
