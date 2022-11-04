/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Zoom levels Reference for WGS.
// Latitude = 0 (Equator); Pixel size = 256, DPI = 96
// Manually verified with values here: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Resolution_and_Scale
// Scales Values are slightly off compared to what ArcGIS provide in their documentation (Im assuming some rounding errors)
// https://developers.arcgis.com/documentation/mapping-apis-and-services/reference/zoom-levels-and-scale/
export const wsg84Lods256px =
[{zoom:0,resolution:156543.03392804097,scale:591658710.9091313},
  {zoom:1,resolution:78271.51696402048,scale:295829355.45456564},
  {zoom:2,resolution:39135.75848201024,scale:147914677.72728282},
  {zoom:3,resolution:19567.87924100512,scale:73957338.86364141},
  {zoom:4,resolution:9783.93962050256,scale:36978669.431820706},
  {zoom:5,resolution:4891.96981025128,scale:18489334.715910353},
  {zoom:6,resolution:2445.98490512564,scale:9244667.357955176},
  {zoom:7,resolution:1222.99245256282,scale:4622333.678977588},
  {zoom:8,resolution:611.49622628141,scale:2311166.839488794},
  {zoom:9,resolution:305.748113140705,scale:1155583.419744397},
  {zoom:10,resolution:152.8740565703525,scale:577791.7098721985},
  {zoom:11,resolution:76.43702828517625,scale:288895.85493609926},
  {zoom:12,resolution:38.21851414258813,scale:144447.92746804963},
  {zoom:13,resolution:19.109257071294063,scale:72223.96373402482},
  {zoom:14,resolution:9.554628535647032,scale:36111.98186701241},
  {zoom:15,resolution:4.777314267823516,scale:18055.990933506204},
  {zoom:16,resolution:2.388657133911758,scale:9027.995466753102},
  {zoom:17,resolution:1.194328566955879,scale:4513.997733376551},
  {zoom:18,resolution:0.5971642834779395,scale:2256.9988666882755},
  {zoom:19,resolution:0.29858214173896974,scale:1128.4994333441377},
  {zoom:20,resolution:0.14929107086948487,scale:564.2497166720689}];

// NOTE: Zoom0 = Zoom1 of 256px tiles
export const wsg84Lods512px =
  [{zoom:0,resolution:78271.51696402048,scale:295829355.45456564},
    {zoom:1,resolution:39135.75848201024,scale:147914677.72728282},
    {zoom:2,resolution:19567.87924100512,scale:73957338.86364141},
    {zoom:3,resolution:9783.93962050256,scale:36978669.431820706},
    {zoom:4,resolution:4891.96981025128,scale:18489334.715910353},
    {zoom:5,resolution:2445.98490512564,scale:9244667.357955176},
    {zoom:6,resolution:1222.99245256282,scale:4622333.678977588},
    {zoom:7,resolution:611.49622628141,scale:2311166.839488794},
    {zoom:8,resolution:305.748113140705,scale:1155583.419744397},
    {zoom:9,resolution:152.8740565703525,scale:577791.7098721985},
    {zoom:10,resolution:76.43702828517625,scale:288895.85493609926},
    {zoom:11,resolution:38.21851414258813,scale:144447.92746804963},
    {zoom:12,resolution:19.109257071294063,scale:72223.96373402482},
    {zoom:13,resolution:9.554628535647032,scale:36111.98186701241},
    {zoom:14,resolution:4.777314267823516,scale:18055.990933506204},
    {zoom:15,resolution:2.388657133911758,scale:9027.995466753102},
    {zoom:16,resolution:1.194328566955879,scale:4513.997733376551},
    {zoom:17,resolution:0.5971642834779395,scale:2256.9988666882755},
    {zoom:18,resolution:0.29858214173896974,scale:1128.4994333441377},
    {zoom:19,resolution:0.14929107086948487,scale:564.2497166720689},
    {zoom:20,resolution:0.07464553543474244,scale:282.12485833603444}];
