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
* how many times the scene should be rendered and skipped
* how many times the scene should be be rendered and timings taken to later be averaged
* what filename options you wish to ignore (i.e. items to exclude from the image naming format)
* what type of test you wish to perform: timing, image, both, or readPixels (timing - take timing data from a renderFrame call; image - save an image of what has been rendered; both - take normal timing data from a renderFrame call and save an image; readPixels - take timing data from a readPixels call & save 6 images contining visual representations of the element Ids, type/order, and distance/depth and using each valid ReadPixels Selector option)
* what models to use for testing
* what display style to use
* what view flags to use
* what render options to use
* what tile admin properties to use

You can specify filename options that you wish to ignore:
When you chose to produce images through an 'image' or 'both' test, the program will name them in the following foramt: modelName_viewName_renderMode_viewFlagOpts_renderModeOpts_tilePropsOpts.png (for example, SmallTextTest008_Wireframe_-fll+scL+cmL+slL-clp+con_+solShd_+inst.png). If you chose to do a 'readPixels' test, the program will save the images produced from this in the following format: depth/elemId/type_readPixelsSelectorOpts_modelName_viewName_renderMode_viewFlagOpts_renderModeOpts_tilePropsOpts.png (for example, type_+geom+dist_TimingTest01_V0_HiddenLine_-fll+scL+cmL+slL-clp+con_+solShd_+inst.png). The read pixels selector options, view flag options, render mode options, and tile properties options will all be an abbreviated string representation of the actual property. For example, the render mode option 'enableInstancing' would be shown as '+inst' in the filename. The 'filenameOptsToIgnore' property allows you to specify either an array of strings or a single space delimited string, where each string item is an abbreviated string representation of a read pixels selector option, view flag option, render mode option, or tile properties option. These options will not be included in the image names.

You can specify which saved view you wish to use for each test with the viewName property.  If external saved views exist for the local file you can specify which external saved view to use with the extViewName property (you can also specify external saved views by name using the viewName property if the name does not clash with a normal saved view).  You can also specify a saved view to use via the viewString property.  The viewString property must include the _viewname and _viewStatePropsString properties (and optionally the _selectedElements and/or _overrideElements properties) which you can copy from the external saved view file.

You can specify any view flag that is part of the ViewFlags class. The types of view flags that can be specified include (but are not limited to):
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
* solarLight
* shadows
* clipVolume
* constructions
* monochrome
* noGeometryMap
* backgroundMap
* hLineMaterialColors
* edgeMask
* ambientOcclusion
* forceSurfaceDiscard

You can specify any render option that is part of the RenderSystem.Options interface. The types of render options that can be specified include (but are not limited to):
* disabledExtensions - This should contain an array of all the WebGL extensions that you wish to disable. The program will restart the IModelApp every time this value changes, to ensure that the render system is changed appropriately (so it is better to group things that use the same render options). The extensions that may be disabled are found in WebGLExtensionName, and they currently include the following: "WEBGL_draw_buffers", "OES_element_index_uint", "OES_texture_float", "OES_texture_half_float", "WEBGL_depth_texture", "EXT_color_buffer_float", "EXT_shader_texture_lod", and "ANGLE_instanced_arrays".
* enableOptimizedSurfaceShaders - This should be a boolean value that describes whether or not you wish to enable optimized surface shaders. It defaults to false (i.e. not enabling the optimized shaders).
* cullAgainstActiveVolume - If true, when a clip volume is applied to the view, geometry will be tested against the clip volume on the CPU and not drawn if it is entirely clipped, improving performance.
* preserveShaderSourceCode - If true, preserve the shader source code as internal strings, useful for debugging purposes.
* displaySolarShadows - If true, display solar shadows. (this will only cause shadows to be displayed if shadows are enabled in the view flags)

You can specify any tile property that is part of the TileAdmin.Props interface. The types of tile properties that can be specified include (but are not limited to):
* maxActiveRequests - The maximum number of simultaneously-active requests. Any requests beyond this maximum are placed into a priority queue. Default value: 10
* disableThrottling - If true, the TileAdmin will immediately dispatch all requests, bypassing the throttling imposed by maxActiveRequests. Default value: false
* enableInstancing - If true, tiles may represent repeated geometry as sets of instances. This can reduce tile size and tile generation time, and improve performance. Default value: false
* retryInterval - If defined, requests for tile content or tile tree properties will be memoized and retried at the specified interval in milliseconds.
* elideEmptyChildContentRequests - If true, requests for content of a child tile will be elided if the child tile's range can be determined to be empty based on metadata embedded in the parent's content. Default value: false
* requestTilesWithoutEdges - By default, when requesting tiles for a 3d view for which edge display is turned off, the response will include both surfaces and edges in the tile data. The tile deserialization code will then discard the edge data to save memory. This wastes bandwidth downloading unused data. Setting the following option to `true` will instead produce a response which omits all of the edge data, improving download speed and reducing space used in the browser cache. Default value: false

If any settings are not specified, the program will not change these settings. For example: if no view flags were specified, the program will not specifically alter the view flags (though the view flags may be altered depending on what settings the chosen view has applied or if a specific display style has been chosen that affects the view flags).

Specifying any individual view flag, render option, or tile property will not overwrite another individual setting. For example: if the visibleEdges view flag is set to true for all tests and an individual test sets the hiddenEdges view flag to true, this will not overwrite the previous setting of true for the visibleEdges view flag.

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
  "numRendersToSkip": 50,
  "numRendersToTime": 100,
  "filenameOptsToIgnore": "+inst +solShd +vsE +cullActVol",
  "testSet": [
    {
      "iModelName": "Wraith.ibim",
      "outputName": "wraithPerformanceResults.csv",
      "tests": [
        {
          "testType": "timing",
          "viewName": "V0",
          "renderOptions": {
		      "disabledExtensions": ["WEBGL_draw_buffers", "OES_texture_half_float"],
          "enableOptimizedSurfaceShaders": true
		      },
          "tileProps": {
            "disableThrottling": false,
            "elideEmptyChildContentRequests": false,
            "enableInstancing": true,
            "maxActiveRequests": 15,
            "retryInterval": 5
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
            "solarLight": false,
            "shadows": false,
            "clipVolume": true,
            "constructions": false,
            "monochrome": false,
            "noGeometryMap": false,
            "backgroundMap": false,
            "hLineMaterialColors": false,
            "edgeMask": 0,
            "ambientOcclusion": false,
            "forceSurfaceDiscard": false
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
      "outputPath": "D:/output/TimingTests/Wrath_MultiMultiPics",
      "view": {
        "width": 500,
        "height": 500
      },
      "testType": "image",
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
    },
    {
      "outputPath": "D:/output/performanceData/",
      "view": {
        "width": 100,
        "height": 500
      },
      "testType": "readPixels",
      "tests": [
        {
          "iModelName": "Wraith.ibim",
          "viewName": "V0",
          "displayStyle": "Smooth"
        },
        {
          "iModelName": "Wraith.ibim",
          "viewString": {
            "_name": "X0",
            "_viewStatePropsString": "{\"viewDefinitionProps\":{\"classFullName\":\"BisCore:SpatialViewDefinition\",\"id\":\"0x15f\",\"jsonProperties\":{\"viewDetails\":{\"acs\":350,\"gridOrient\":4,\"gridSpaceX\":0.1}},\"code\":{\"spec\":\"0x1c\",\"scope\":\"0x16\",\"value\":\"Multi-Model Views - View 1\"},\"model\":\"0x16\",\"categorySelectorId\":\"0x162\",\"displayStyleId\":\"0x161\",\"isPrivate\":false,\"description\":\"\",\"cameraOn\":true,\"origin\":[-0.6169680116017681,0.6245706389447975,-0.4111743483104971],\"extents\":[1.5381081553294678,0.8043429514815896,1.6789170854960223],\"angles\":{\"pitch\":33.220202827884194,\"roll\":-81.9196063778328,\"yaw\":-4.447540500469335},\"camera\":{\"lens\":75.59999999999965,\"focusDist\":0.9914585427480106,\"eye\":[1.0014560684887355,-0.42819514236474876,0.20350536578493128]},\"modelSelectorId\":\"0x160\"},\"categorySelectorProps\":{\"classFullName\":\"BisCore:CategorySelector\",\"id\":\"0x162\",\"code\":{\"spec\":\"0x8\",\"scope\":\"0x16\",\"value\":\"Multi-Model Views - View 1\"},\"model\":\"0x16\",\"categories\":[\"0x17\",\"0x4d\",\"0x4f\",\"0x51\",\"0x53\",\"0x55\",\"0x57\",\"0x59\",\"0x5b\",\"0x5d\",\"0x5f\",\"0x61\",\"0x63\",\"0x65\",\"0x67\",\"0x69\",\"0x6b\",\"0x6d\",\"0x6f\",\"0x71\",\"0x73\",\"0x75\",\"0x77\",\"0x79\",\"0x7b\",\"0x7d\",\"0x7f\",\"0x81\",\"0x83\",\"0x85\",\"0x87\",\"0x89\",\"0x8b\",\"0x8d\",\"0x8f\",\"0x91\",\"0x93\",\"0x95\",\"0x97\",\"0x99\",\"0x9b\",\"0x9d\",\"0x9f\",\"0xa1\",\"0xa3\",\"0xa5\",\"0xa7\",\"0xa9\",\"0xab\",\"0xad\",\"0xaf\",\"0xb1\",\"0xb3\",\"0xb5\",\"0xb7\",\"0xb9\",\"0xbb\",\"0xbd\",\"0xbf\",\"0xc1\",\"0xc3\",\"0xc5\",\"0xc7\",\"0xc9\",\"0xcb\",\"0xcd\",\"0xcf\",\"0xd1\",\"0xd3\",\"0xd5\",\"0xd7\",\"0xd9\",\"0xdb\",\"0xdd\",\"0xdf\",\"0xe1\",\"0xe3\",\"0xe5\",\"0xe7\",\"0xe9\",\"0xeb\",\"0xed\",\"0xef\",\"0xf1\",\"0xf3\",\"0xf5\",\"0xf7\",\"0xf9\",\"0xfb\",\"0xfd\",\"0xff\",\"0x101\",\"0x103\",\"0x105\",\"0x107\",\"0x109\",\"0x10b\",\"0x10d\",\"0x10f\",\"0x111\",\"0x113\",\"0x115\",\"0x117\",\"0x119\",\"0x11b\",\"0x11d\",\"0x11f\",\"0x121\",\"0x123\",\"0x125\",\"0x127\",\"0x129\",\"0x12b\",\"0x12d\",\"0x12f\",\"0x131\",\"0x133\",\"0x135\",\"0x137\",\"0x139\",\"0x13b\",\"0x13d\",\"0x13f\"]},\"displayStyleProps\":{\"classFullName\":\"BisCore:DisplayStyle3d\",\"id\":\"0x161\",\"jsonProperties\":{\"styles\":{\"backgroundColor\":4662563,\"environment\":{\"ground\":{\"aboveColor\":32768,\"belowColor\":1262987,\"display\":false,\"elevation\":-0.01},\"sky\":{\"display\":false,\"file\":\"\",\"groundColor\":8228728,\"groundExponent\":4,\"nadirColor\":3880,\"skyColor\":16764303,\"skyExponent\":4,\"zenithColor\":16741686}},\"hline\":{\"transThreshold\":0.3},\"sceneLights\":{\"ambient\":{\"intensity\":100,\"type\":2},\"flash\":{\"intensity\":100,\"type\":3},\"sun\":{\"intensity\":110499.99999999999,\"type\":1},\"sunDir\":[-0.7273189993371552,0.037016235179470065,-0.6853005702145135]},\"subCategoryOvr\":[{\"invisible\":true,\"subCategory\":\"0x141\"},{\"invisible\":true,\"subCategory\":\"0x142\"},{\"invisible\":true,\"subCategory\":\"0x143\"},{\"invisible\":true,\"subCategory\":\"0x144\"},{\"invisible\":true,\"subCategory\":\"0x145\"},{\"invisible\":true,\"subCategory\":\"0x146\"},{\"invisible\":true,\"subCategory\":\"0x147\"},{\"invisible\":true,\"subCategory\":\"0x148\"},{\"invisible\":true,\"subCategory\":\"0x149\"},{\"invisible\":true,\"subCategory\":\"0x14a\"},{\"invisible\":true,\"subCategory\":\"0x14b\"},{\"invisible\":true,\"subCategory\":\"0x14c\"},{\"invisible\":true,\"subCategory\":\"0x14d\"},{\"invisible\":true,\"subCategory\":\"0x14e\"},{\"invisible\":true,\"subCategory\":\"0x14f\"},{\"invisible\":true,\"subCategory\":\"0x150\"},{\"invisible\":true,\"subCategory\":\"0x151\"},{\"invisible\":true,\"subCategory\":\"0x152\"},{\"invisible\":true,\"subCategory\":\"0x153\"},{\"invisible\":true,\"subCategory\":\"0x154\"},{\"invisible\":true,\"subCategory\":\"0x155\"},{\"invisible\":true,\"subCategory\":\"0x156\"},{\"invisible\":true,\"subCategory\":\"0x157\"},{\"invisible\":true,\"subCategory\":\"0x158\"},{\"invisible\":true,\"subCategory\":\"0x159\"},{\"invisible\":true,\"subCategory\":\"0x15a\"},{\"invisible\":true,\"subCategory\":\"0x15b\"},{\"invisible\":true,\"subCategory\":\"0x15c\"},{\"invisible\":true,\"subCategory\":\"0x15d\"}],\"viewflags\":{\"noFill\":true,\"renderMode\":6}}},\"code\":{\"spec\":\"0xa\",\"scope\":\"0x16\",\"value\":\"Smooth\"},\"model\":\"0x16\"},\"modelSelectorProps\":{\"classFullName\":\"BisCore:ModelSelector\",\"id\":\"0x160\",\"code\":{\"spec\":\"0x11\",\"scope\":\"0x16\",\"value\":\"Multi-Model Views - View 1\"},\"model\":\"0x16\",\"models\":[\"0x1c\",\"0x1f\",\"0x22\",\"0x24\",\"0x26\",\"0x29\",\"0x2a\",\"0x2c\",\"0x2f\",\"0x30\",\"0x32\"]}}",
            "_selectedElements": "[\"0x56f\"]"
          }
        },
        {
          "iModelName": "Wraith_MultiMulti.ibim",
          "viewName": "V0",
          "viewFlags": {
            "renderMode": "Wireframe"
          }
        }
      ]
    }
  ]
}

## Performance file output
The performance data output is in csv format (and is intended to be saved as a csv file, though you may specify otherwise), and you should be able to open the performance file in Excel as well, for easier viewing. The string "End of Tests-----------" will be appended to the end of the csv file once the entire performance test run has been completed.

The performance data file should always contain the following column headers:
* iModel - the name of the imodel file
* View - the name of the view used
* Screen Size - the size of the view screen in width X height
* Display Style - the name of the display style used
* Render Mode - the name of the render mode used
* View Flags - a string representation of view flag specifications that differ from those defaults found in the ViewFlags class
* Disabled Exts - a string representation of all the WebGL extensions that have been disabled

The performance data file may also contain any or all of the following column headers:
* ReadPixels Selector - a string representation of the Pixel.Selector used in the readPixels call; this will be blank if readPixels is not called
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
* Total Render Time - the time it takes to render everything (in ms); this is the sum of all of the previous times (excluding the Tile Loading Time); if you are running a 'timing' test, this value is the time it takes to call everything in the renderFrame() function; if you are running a 'readPixels' test, this value is the time it takes to render the stuff that you will then read when calling the SceneCompositor's readPixels() function
* Finish GPU Queue - the time it takes to call the gl.readPixels() function (in ms); i.e. the time it takes the GPU to finish all of the tasks currently in its queue
* Total Time - The sum of 'Total Render Time', 'Finish GPU Queue', and 'Read Pixels' (in ms); 'Read Pixels' will be 0 if you are running a 'timing' test, as it will not call the readPixels function
* Effective FPS - the average effective FPS (frames per second) value based on the calculated 'total time w/ gpu'. Keep in mind that this is the FPS rate when forcing the GPU to finish all of it's current tasks either before the CPU recieves the next frame to draw (if running a 'timing' test) or before the SceneCompositor's readPixels function is called (if running a 'readPixels' test). Therefore, the actual FPS value when running the program outside of this testing environment may be slightly different (it should generally be faster, as the CPU normally starts rendering the next frame while the GPU finishes up; however, it may be slower if the rendering system intentionally throttles back the fps to a set maximum--for example, 60fps)

The 'View Flags' column contains a string representation of view flag specifications that differ from those defaults found in the ViewFlags class. This string representation may consist of any or all of the following:
* -dim  - dimensions are hidden
* -pat  - pattern geometry is hidden
* -wt   - non-zero lines are displayed using weight 0
* -sty  - line styles are not used
* -trn  - element transparency is not used
* -fll  - the fills on filled elements are not displayed
* -txt  - do not display texture maps for material assignments; only use material color for display
* -mat  - geometry with materials draws as if it has no material
* +vsE  - visible edges in shaded render mode are visible
* +hdE  - hidden edges in shaded render mode are visible
* +scL  - source lights in spatial models are used
* +cmL  - camera (ambient, portrait, flashbulb) lights are used
* +slL  - source lights in spatial models are used
* +shd  - shadows are visible
* -clp  - clip volume is not applied
* +con  - construction class geometry is visible
* +mno  - all graphics are drawn in a single color
* +noG  - ignore geometry maps
* +bkg  - display background maps
* +hln  - use material colors for hidden lines
* +genM - generate mask (i.e. edgeMask view flag was set to 1)
* +useM - use mask (i.e. edgeMask view flag was set to 2)

Additionally, if the external saved view contains selected elements, the 'View Flags' column may contain the following:
* +selEl - elements in this view have been selected
* +ovrEl - elements in this view have feature overrides

The 'Render Options' column contains a string representation of the render options that have been set. This string representation may consist of any or all of the following:
* -drawBuf      - WEBGL_draw_buffers has been disabled, so the fragment shader will not be able to write to several textures
* -unsignedInt  - OES_element_index_uint has been disabled, so gl.UNSIGNED_INT will not be supported for WebGLRenderingContext.drawElements()
* -texFloat     - OES_texture_float has been disabled, so floating-point pixel types for textures will not be exposed
* -texHalfFloat - OES_texture_half_float has been disabled, so texture formats with 16- (aka half float) and 32-bit floating-point components will not be available
* -depthTex     - WEBGL_depth_texture has been disabled, so 2D depth and depth-stencil textures will not be defined
* -float        - EXT_color_buffer_float has been disabled, so the ability to render a variety of floating point formats will not be available
* -texLoad      - EXT_shader_texture_lod has been disabled, so additional texture functions to the OpenGL ES SHading Language which provide the shader writer with explicit control of LOD (Loevel of detail) will not be available
* -instArrays   - ANGLE_instanced_arrays has been disabled, so the program will not be allowed to draw the same object or groups of similar objects multiple times, even if they share the same vertex data, primitive count, and type
* +optSurf      - the optimized shaders will be used when in 3d views if the render mode is wireframe or if both the render mode is smooth shade and visible edges are turned off.
* +cullActVol   - When a clip volume is applied to the view, geometry will be tested against the clip volume on the CPU and not drawn if it is entirely clipped, improving performance
* +shadeSrc     - This preserves the shader source code as internal strings, useful for debugging purposes
* +solShd       - Display solar shadows when the shadows view flag is enabled

The 'Tile Props' column contains a string representation of the tile properties that have been set. This string representation may consist of any or all of the following:
* -throt - The TileAdmin will immediately dispatch all requests, bypassing the throttling imposed by maxActiveRequests
* +elide - Requests for content of a child tile will be elided if the child tile's range can be determined to be empty based on metadata embedded in the parent's content
* +inst  - Tiles may represent repeated geometry as sets of instances. This can reduce tile size and tile generation time, and improve performance
* +max   - The maximum number of simultaneously-active requests. Any requests beyond this maximum are placed into a priority queue. The max number specified will also be added to the end of this string representation
* +retry - Requests for tile content or tile tree properties will be memoized and retried at the specified interval in milliseconds

The 'ReadPixels Selector' column contains a string representation of the Pixel.Selector that has been chosen for the readPixels call. The column entry will be blank if readPixels was not tested. The string representation may be any of the following:
* +feature - Pixel.Selector.Feature is used; this reads the feature information for each pixel
* +geom+dist - Pixel.Selector.GeometryAndDistance is used; this reads the geometry information (i.e. if an element is linear, planar, surface, etc.) and the distance (i.e. depth) information
* +feature+geom+dist - Pixel.Selector.All is used; this reads both the Feature and the GeometryAndDistance information