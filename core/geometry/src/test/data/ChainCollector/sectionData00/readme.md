This directory has data files line data for road cross sections to be assembled by an ongoing AI analysis project.

MadhavInput.json is the raw data.
  * Top level is an array of json Objects
  * within each object:
     * sourceId is an external refernece
     * distanceAlong is the station for the cut
     * ray has the origin and perpendicular to the cut
     * elements is an array; each entry is:
        * elementId, categoryId, modelId
        * geometries is an array of arrays of points

The outer array has 6 section entries.  We'll call the sectionA through sectionF.
   * files sectionA.json through sectionF.json are hand-edited extracts directly from MadhavInupt.json
   * files sectionA.imjs through sectionF.imjs are extracted from those via the gema mappings in extractLineStringsFromGeometries.g, i.e.
   `gema -f pack.g sectionA.json | gema -f extractLineStringsFromGeometries.g  > sectionA.imjs`


sectionC, sectionD, sectionE are clean data.  That is, each of array under "geometries" is either
   * a closed loop of points.
     * the various loops share edges but do not otherwise overlap.
   * unclosed linework completely outside the area of the closed loops

sectionA and SectionB have additional linework (left end) which is apparently partial section of a bridge or other support structure.

sectionF is much messier.   Things that should be closed quads are split in multiple pieces, and have an X through the quad.

In regionboundaries.test.ts, the "sectioningExample" test will
  * read the imjs files
  * apply constructAllXYRegions
  * display the analyzed areas wtih quirky tics indicating detection adjacent areas




