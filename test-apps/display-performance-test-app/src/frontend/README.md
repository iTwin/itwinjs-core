# How to Utilize the Performance Tests

## To run a performance test with electron:
* Run the command "npm run start:electron".

## To run a performance test on a web browser:
* Run the command "npm run start:web" to just run the backend. Then, go to a web browser and go to the site http:\\\\localhost:3000 to start the test.
* Run the command "npm run test:chrome" to run the backend and automatically bring up a Google Chrome browser window to start the test. This will also automatically kill <b>ALL</b> Google Chrome browser windows once the test has completed.
* Run the command "npm run test:edge" to run the backend and automatically bring up an Edge browser window to start the test. This will also automatically kill <b>ALL</b> Edge browser windows once the test has completed.
* Run the command "npm run test:firefox" to run the backend and automatically bring up a FireFox browser window to start the test. This will also automatically kill <b>ALL</b> FireFox browser windows once the test has completed.

## Options available for a performance test run:
These options will work for running with electron or for a browser (though specifying a specific browser when running with electron will have no effect). Always use a double backslash when specifying a file path. All of these options can be specified in any order, and you can use any number of these options.  For example, to specify everything, your command could look like this: "npm run start:web chrome d:\\\\develop\\\\testConfig.json c:\\\\performanceOutput\\\\".
* To specify a json config file that you wish to use, add the full file path to the command. For example, run the command "npm run start:web D:/timingTests.json" or "npm run start:web C:\\\\wireframeTimings.json". If no valid json config file has been specified, the default json config file (DefaultConfig.json) will be used.
* To specify an output path, simply add the output path to the command. For example, run the command "npm run start:web C:\\\\output\\\\performanceData\\\\" to use this as the base path for where the output will be stored. Keep in mind that any outputPath variable specified in your json config file will be assumed to be a subdirectory of the output path specified when you called your command unless it starts with the name of a drive (i.e. C:\\\\, D:\\\\, etc.).
* To specify a particular browser that you wish to run in, you can add the option "chrome", "edge", or "firefox" to your command. If you are running intending to use a browser for the frontend, this will cause a new browser window to open to http:\\\\localhost:3000 and begin running the performance test once the backend has finished getting started. However, this option will have no effect if you are running in electron.

## Configuration json file
The default configuration file allows you to specify the following:
* where you want to output the files created by the test program
* what you want the test file(s) created to be named
* where the imodels you want to use are located (i.e. using a local file path or using the iModelHub)
* what size you want the view screen to be
* what type of test you wish to perform (either a timing test or saving an image of what has been rendered)
* what models to use for testing
* what display style to use
* what view flags to use
* what render options to use

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

The types of render options that can be specified are as follows:
* disabledExtensions - This should contain an array of all the WebGL extensions that you wish to disable. The program will restart the IModelApp every time this value changes, to ensure that the render system is changed appropriately (so it is better to group things that use the same render options). The extensions that may be disabled are found in WebGLExtensionName, and they currently include the following: "WEBGL_draw_buffers", "OES_element_index_uint", "OES_texture_float", "OES_texture_half_float", "WEBGL_depth_texture", "EXT_color_buffer_float", "EXT_shader_texture_lod", and "ANGLE_instanced_arrays".

If any settings are not specified, the program will not change these settings. For example: if no view flags were specified, the program will not specifically alter the view flags. (though the view flags may be altered depending on what settings the chosen view has applied or if a specific display style has been chosen that affects the view flags).

Specifying where the imodels are located:
If given the option of using a local file path or using the iModelHub, the program will first attempt to access the imodel using the local file path; if that fails, the program will then attempt to use the iModelHub location to access the imodel.
* To specify a local file path to use for accessing an imodel, set the "iModelLocation" setting in the json configuration file (ex. "iModelLocation": "D:/models/").
* To specify an iModelHub project to use, set the "iModelHubProject" setting in the json configuration file (ex. "iModelHubProject": "DisplayPerformanceTest").

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
  "testSet": [
    {
      "iModelName": "Wraith.ibim",
      "outputName": "wraithPerformanceResults.csv",
      "tests": [
        {
          "testType": "timing",
          "viewName": "V0",
          "renderOptions": {
		      "disabledExtensions": ["WEBGL_draw_buffers", "OES_texture_half_float"]
		      },
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
* Effective FPS - the average effective FPS (frames per second) value based on the calculated 'total time w/ gpu'. Keep in mind that this is the FPS rate when forcing the GPU to finish all of it's current tasks before the CPU recieves the next frame to draw. Therefore, the actual FPS value when running the program outside of this testing environment may be slightly different (it should generally be faster, as the CPU normally starts rendering the next frame while the GPU finishes up; however, it may be slower if the rendering system intentionally throttles back the fps to a set maximum--for example, 60fps)

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