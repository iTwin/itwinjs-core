/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { ContourDisplay } from "../ContourDisplay";
import { LinePixels } from "../LinePixels";

describe.only("ContourDisplay", () => {
  it("Ensure ContourDisplay derives values properly from JSON, including setting defaults and round-tripping through JSON", () => {
    function verifyDefaults(contourDisplay: ContourDisplay) {
      expect(contourDisplay.displayContours).to.equal(false);
      expect(contourDisplay.groups).to.deep.equal([]);
    }

    // check if the creation and back-and-forth via JSON works
    function verifyBackAndForth(a: ContourDisplay) {
      const aCopy = ContourDisplay.fromJSON(a.toJSON());
      expect(aCopy.equals(a)).to.be.true;
    }

    // create default ContourDisplay object and verify the default values are correct
    const defaultContourDisplay = ContourDisplay.fromJSON();
    verifyDefaults(defaultContourDisplay);

    // check if the creation and back-and-forth via JSON works using the default object
    verifyBackAndForth(defaultContourDisplay);
  });

  it("Ensure ContourDisplay can use API for partial reconfigurations", () => {
    // create a ContourDisplay object with some configured values
    const contourDisplayA = ContourDisplay.fromJSON({
      displayContours: false,
      groups: [
        {
          name: "test",
          subCategories: "",
          contourDef: {
            minorStyle: {
              pattern: LinePixels.Code1,
            },
            majorStyle: {
              pattern: LinePixels.Code6,
            },
            minorInterval: 10,
            majorIntervalCount: 2,
            showGeometry: false,
          },
        },
      ],
    });

    // ensure objects match if we modify it to have the same value for displayContours
    let contourDisplayB = contourDisplayA.withDisplayContours(false);
    expect(contourDisplayA.equals(contourDisplayB)).to.be.true;

    // ensure objects do not match if we modify it to have the same value for displayContours
    contourDisplayB = contourDisplayA.withDisplayContours(true);
    expect(contourDisplayA.equals(contourDisplayB)).to.be.false;

    // modify a group
    const groupsA = contourDisplayA.groups;
    let modifiedGroup = groupsA[0].clone({name: "test 2"});
    expect(groupsA[0].equals(modifiedGroup)).to.be.false; // ensure old group and modified group do not match
    contourDisplayB = contourDisplayA.clone({groups: [ modifiedGroup ]});
    expect(contourDisplayA.equals(contourDisplayB)).to.be.false; // ensure the main object itself no longer matches

    // modify a contour
    let modifiedContour = groupsA[0].contourDef.clone({showGeometry: true});
    expect(modifiedContour.equals(groupsA[0].contourDef)).to.be.false; // ensure the old contour and modified contour do not match
    modifiedGroup = groupsA[0].clone({contourDef: modifiedContour});
    expect(groupsA[0].equals(modifiedGroup)).to.be.false; // ensure old group and modified group do not match
    contourDisplayB = contourDisplayA.clone({groups: [ modifiedGroup ]});
    expect(contourDisplayA.equals(contourDisplayB)).to.be.false; // ensure the main object itself no longer matches

    // modify a contour style
    let modifiedContourStyle = groupsA[0].contourDef.minorStyle.clone({pattern: LinePixels.Solid});
    expect(modifiedContourStyle.equals(groupsA[0].contourDef.minorStyle)).to.be.false; // ensure old contour style and modified contour style do not match
    modifiedContour = groupsA[0].contourDef.clone({minorStyle: modifiedContourStyle});
    expect(modifiedContour.equals(groupsA[0].contourDef)).to.be.false; // ensure the old contour and modified contour do not match
    modifiedGroup = groupsA[0].clone({contourDef: modifiedContour});
    expect(groupsA[0].equals(modifiedGroup)).to.be.false; // ensure old group and modified group do not match
    contourDisplayB = contourDisplayA.clone({groups: [ modifiedGroup ]});
    expect(contourDisplayA.equals(contourDisplayB)).to.be.false; // ensure the main object itself no longer matches

    // unmodify the contour style
    modifiedContourStyle = contourDisplayB.groups[0].contourDef.minorStyle.clone({pattern: LinePixels.Code1});
    expect(modifiedContourStyle.equals(groupsA[0].contourDef.minorStyle)).to.be.true; // ensure old contour style and modified contour style do match
    modifiedContour = groupsA[0].contourDef.clone({minorStyle: modifiedContourStyle});
    expect(modifiedContour.equals(groupsA[0].contourDef)).to.be.true; // ensure the old contour and modified contour do match
    modifiedGroup = groupsA[0].clone({contourDef: modifiedContour});
    expect(groupsA[0].equals(modifiedGroup)).to.be.true; // ensure old group and modified group do match
    contourDisplayB = contourDisplayA.clone({groups: [ modifiedGroup ]});
    expect(contourDisplayA.equals(contourDisplayB)).to.be.true; // ensure the main object itself matches
  });
});
