# How to Utilize the Performance Tests

## To run all performance tests (i.e. all files ending in .test.ts):
1. To specify a json config file that you wish to use, set the 'jsonFilePath' variable to the full file path of the json file you wish to use. For example, "D:/timingTests.json" or "C:\\wireframeTimings.json". If no valid json config file has been specified, the default json config file (DefaultConfig.json) will be used.
2. run the command "npm run test:frontend:performance"

## Configuration json file
The default configuration file allows you to specify the following:
* where you want to output the files created by the test program
* what you want the test file(s) created to be named
* where the imodels you want to use are located
* what size you want the view screen to be
* what type of test you wish to perform (either a timing test or saving an image of what has been rendered)
* what models to use for testing
* what display style to use
* what view flags to use

The types of view flags that can be specified are as follows:
* renderMode
* dimensions
* patterns
* weights
* styles
* transparency
* fill
* textures
* materials
* visibleEdges
* hiddenEdges
* sourceLights
* cameraLights
* solarLights
* shadows
* clipVolume
* constructions
* monochrome
* noGeometryMap
* backgroundMap
* hLineMaterialColors
* edgeMask

If any settings are not specified, the program will not change these settings. For example: if no view flags were specified, the program will not specifically alter the view flags. (though the view flags may be altered depending on what settings the chosen view has applied or if a specific display style has been chosen that affects the view flags).

The json config file allows you to specify settings for the entire test run, for a specific model, and for a specific test performed on a given model. Priority for settings will be given first to those for a specific test, then for a specific model, and finally for the entire test run. For example: if transparency is set to true for the entire test run, but a specific test changes transparency to false, that specific test will NOT have transparency even though the rest of the tests run WILL have transparency.


Below is an example json config file:

{
  "outputName": "performanceResults.csv",
  "outputPath": "D:/output/performanceData/",
  "iModelLocation": "D:/models/TimingTests/",
  "view": {
    "width": 1000,
    "height": 1000
  },
  "modelSet": [
    {
      "iModelName": "Wraith.ibim",
      "outputName": "wraithPerformanceResults.csv",
      "tests": [
        {
          "testType": "timing",
          "viewName": "V0",
          "viewFlags": {
            "renderMode": "SmoothShade",
            "dimensions": true,
            "patterns": true,
            "weights": true,
            "styles": true,
            "transparency": true,
            "fill": true,
            "textures": true,
            "materials": true,
            "visibleEdges": false,
            "hiddenEdges": false,
            "sourceLights": false,
            "cameraLights": false,
            "solarLights": false,
            "shadows": false,
            "clipVolume": true,
            "constructions": false,
            "monochrome": false,
            "noGeometryMap": false,
            "backgroundMap": false,
            "hLineMaterialColors": false,
            "edgeMask": 0
          },
          "displayStyle": "Filled Hidden Line"
        },
        {
          "testType": "timing",
          "viewName": "V0",
          "viewFlags": {
            "fill": true
          },
          "displayStyle": "Filled Hidden Line"
        }
      ]
    },
    {
      "iModelName": "Wraith_MultiMulti.ibim",
      "outputPath": "D:/models/TimingTests/Wrath_MultiMultiPics",
      "view": {
        "width": 500,
        "height": 500
      },
      "testType": "image"
      "tests": [
        {
          "viewName": "V0",
          "displayStyle": "Smooth"
        },
        {
          "viewName": "V0",
          "viewFlags": {
            "renderMode": "Wireframe"
          }
        },
        {
          "viewName": "V1",
          "viewFlags": {
            "renderMode": "Wireframe"
          }
        }
      ]
    }
  ]
}

## Performance file output
The performance data output is in csv format (and is intended to be saved as a csv file, though you may specify otherwise), and you should be able to open the performance file in Excel as well, for easier viewing.

The performance data file should always contain the following column headers:
* iModel - the name of the imodel file
* View - the name of the view used
* Screen Size - the size of the view screen in width X height
* Display Style - the name of the display style used
* Render Mode - the name of the render mode used
* View Flags - a string representation of view flag specifications that differ from those defaults found in the ViewFlags class

The performance data file may also contain any or all of the following column headers:
* Tile Loading Time - the time it takes to load all of the tiles for this model (in ms)
* Scene Time - the time it takes to load the scene, i.e. the time it takes to do everything in the renderFrame() function except for the drawFrame() call (in ms)
* Begin Paint - the time it takes to call the _beginPaint() function (in ms)
* Init Commands - the time it takes to call the _renderCommands.init() function (in ms)
* Render Background - the time it takes to start the compositor.draw() function until you finish the this.renderBackground() function (in ms); this includes the Compositor's update() function, clearOpaque() function, and the aforementioned renderBackground() function
* Render SkyBox - the time it takes to call the renderSkyBox() function (in ms)
* Render Terrain - the time it takes to call the renderTerrain() function (in ms)
* Enable Clipping - the time it takes to call the _target.pushActiveVolume() function (in ms)
* Render Opaque - the time it takes to call the renderOpaque() function (in ms)
* Render Stencils - the time it takes to call the renderStencilVolumes() function (in ms)
* Render Translucent - the time it takes to call the _geom.composite!.update() function, clearTranslucent() function, and renderTranslucent() function (in ms)
* Render Hilite - the time it takes to call the renderHilite() function (in ms)
* Composite - the time it takes to call the composite() function (in ms)
* Overlay Draws - the time it takes to finish the compositor.draw() function until you finish the decorations (in ms); this includes the Compositor's _target.popActiveVolume() function, the _stack.pushState() function, the drawPass() function for WorldOverlay and ViewOverlay, and the _stack.pop() function
* End Paint - the time it takes to call the _endPaint() function
* Total RenderFrame Time - the time it takes to call everything in the renderFrame() function (in ms); this is the sum of all of the previous times (excluding the Tile Loading Time)
* Finish GPU Queue - the time it takes to call the gl.readPixels() function (in ms); i.e. the time it takes the GPU to finish all of the tasks currently in its queue
* Total Time w/ GPU - the time it takes to call everything in the renderFrame() function and for the GPU to finish all of the tasks currently in its queue (in ms); i.e. the sum of the 'Total RenderFrame Time' and the 'Finish GPU Queue' times

The 'View Flags' column contains a string representation of view flag specifications that differ from those defaults found in the ViewFlags class. This string representation may consist of any or all of the following:
* -dim  - dimensions are hidden
* -pat  - pattern geometry is hidden
* -wt   - non-zero lines are displayed using weight 0
* -sty  - line styles are not used
* -trn  - element transparency is used
* -fll  - the fills on filled elements are not displayed
* -txt  - do not display texture maps for material assignments; only use material color for display
* -mat  - geometry with materials draws as if it has no material
* +vsE  - visible edges in shaded render mode are hidden
* +hdE  - hidden edges in shaded render mode are hidden
* +scL  - source lights in spatial models are not used
* +cmL  - camera (ambient, portrait, flashbulb) lights are not used
* +slL  - source lights in spatial models are not used
* +shd  - shadows are hidden
* -clp  - clip volume is not applied
* +con  - construction class geometry is hidden
* +mno  - all graphics are drawn in a single color
* +noG  - ignore geometry maps
* +bkg  - display background maps
* +hln  - use material colors for hidden lines
* +genM - generate mask (i.e. edgeMask view flag was set to 1)
* +useM - use mask (i.e. edgeMask view flag was set to 2)