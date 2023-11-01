/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
package com.bentley.imodeljs_test_app

import android.app.Activity
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.res.AssetManager
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.result.contract.ActivityResultContract
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import com.bentley.itwin.IModelJsHost
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.net.URLConnection
import kotlin.system.exitProcess
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Determines the display name for the uri.
 * @param uri The input content Uri.
 * @return The display name or null if it wasn't found.
 */
fun ContentResolver.getFileDisplayName(uri: Uri): String? {
    // Query the content resolver only if we have a content Uri
    return uri.takeIf { uri.scheme == ContentResolver.SCHEME_CONTENT }?.let {
        query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null, null)?.use { cursor ->
            cursor.takeIf { cursor.moveToFirst() }?.getString(0)
        }
    }
}

/**
 * Copies the input uri to the destination directory.
 * @param uri The input content Uri to copy.
 * @param destDir The destination directory.
 * @return The full path of the copied file, null if it failed.
 */
fun Context.copyToExternalFiles(uri: Uri, destDir: String): String? {
    return contentResolver.getFileDisplayName(uri)?.let { displayName ->
        getExternalFilesDir(null)?.let { filesDir ->
            contentResolver.openInputStream(uri)?.use { input ->
                val outDir = File(filesDir.path, destDir)
                outDir.mkdirs()
                val outputFile = File(outDir, displayName)
                outputFile.outputStream().use {
                    input.copyTo(it)
                }
                outputFile.path
            }
        }
    }
}

fun JSONObject.optStringNotEmpty(name: String): String? {
    return optString(name).takeIf { it.isNotEmpty() }
}

typealias PickUriContractType = ActivityResultContract<Nothing?, Uri?>

class PickUriContract(private val destDir: String) : PickUriContractType() {
    private lateinit var context: Context

    override fun createIntent(context: Context, input: Nothing?): Intent {
        this.context = context
        return Intent()
            .setAction(Intent.ACTION_OPEN_DOCUMENT)
            .setType("*/*")
            .addCategory(Intent.CATEGORY_OPENABLE)
    }

    override fun parseResult(resultCode: Int, intent: Intent?): Uri? {
        val uri = intent?.takeIf { resultCode == Activity.RESULT_OK }?.data
        if (uri != null) {
            context.copyToExternalFiles(uri, destDir)?.let { result ->
                return Uri.parse(result)
            }
        }
        return uri
    }
}

// Very similar to WebViewAssetLoader.AssetsPathHandler except it doesn't log an error when a resource isn't found, also doesn't handle SvgZ streams.
class AssetsPathHandler(context: Context) : WebViewAssetLoader.PathHandler {
    private val mContext = context

    private fun removeLeadingSlash(path: String): String {
        return if (path.startsWith('/')) path.substring(1) else path
    }

    private fun openAsset(path: String): InputStream {
        return mContext.assets.open("www/${removeLeadingSlash(path)}", AssetManager.ACCESS_STREAMING)
    }

    private fun guessMimeType(path: String): String {
        return URLConnection.guessContentTypeFromName(path) ?: "text/plain"
    }

    override fun handle(path: String): WebResourceResponse? {
        return try {
            WebResourceResponse(guessMimeType(path), null, openAsset(path))
        } catch (e: IOException) {
            WebResourceResponse(null, null, null)
        }
    }
}

@Suppress("SpellCheckingInspection")
class MainActivity : AppCompatActivity() {
    private lateinit var host: IModelJsHost
    private var promiseName: String = ""
    private lateinit var env: JSONObject
    private var exitAfterModelOpened = false

    companion object {
        const val BIM_CACHE_DIR = "bim_cache"
    }

    private fun log(message: String) {
        // Print out a message with a unique prefix so that it can be uniquely found in the TORRENT
        // of text that comes out of adb logcat.
        println("com.bentley.display_test_app: $message")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(true)
        loadEnvJson()
        val authClient = DtaServiceAuthorizationClient.create(env)
        val alwaysExtractAssets = true // for debugging, otherwise the host will only extract when app version changes
        host = IModelJsHost(this, alwaysExtractAssets, authClient, true).apply {
            setBackendPath("www/mobile")
            setHomePath("www/home")
            startup()
        }

        val webView = WebView(this)
        // using a WebViewAssetLoader so that the localization json files load properly
        // the version of i18next-http-backend we're using tries to use the fetch API with file URL's (apparently fixed in version 2.0.1)
        val assetLoader = WebViewAssetLoader.Builder().addPathHandler("/", AssetsPathHandler(this)).build()

        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }
        }

        val startPickDocument = registerForActivityResult(PickUriContract(BIM_CACHE_DIR)) { uri ->
            if (uri != null && promiseName.isNotEmpty()) {
                val js = "if (window.$promiseName) window.$promiseName(\"$uri\"); else console.log('Error: window.$promiseName is not defined!');"
                MainScope().launch {
                    webView.evaluateJavascript(js, null)
                }
            }
        }

        // The linter is broken, and claims that the interface functions in this class do not have
        // the @JavascriptInterface annotation, despite the fact that they do.
        @Suppress("JavascriptInterface")
        webView.addJavascriptInterface(
            object {
                @JavascriptInterface
                @Suppress("unused")
                fun openModel(promiseName: String) {
                    this@MainActivity.promiseName = promiseName
                    startPickDocument.launch(null)
                }

                @JavascriptInterface
                @Suppress("unused")
                fun modelOpened(modelName: String) {
                    log("iModel opened: $modelName")
                }

                @JavascriptInterface
                @Suppress("unused", "UNUSED_PARAMETER")
                fun firstRenderFinished(_dummy: String) {
                    log("First render finished.")
                    if (exitAfterModelOpened) {
                        exitProcess(0)
                    }
                }
            }, "DTA_Android")

        host.webView = webView
        setContentView(webView)

        var args = "&standalone=true"
        env.optStringNotEmpty("IMJS_STANDALONE_FILENAME")?.let { fileName ->
            // ensure fileName already exists in the external files
            getExternalFilesDir(BIM_CACHE_DIR)?.let { filesDir ->
                val fullPath = File(filesDir, fileName)
                if (fullPath.exists()) {
                    args += "&iModelName=${Uri.encode(fullPath.toString())}"
                } else {
                    log("requested imodel ($fullPath) not found!")
                }
            }
        }

        if (authClient != null) {
            val remoteIds = listOfNotNull(
                env.optStringNotEmpty("IMJS_ITWIN_ID"),
                env.optStringNotEmpty("IMJS_IMODEL_ID")
            )
            if (remoteIds.size == 2) {
                args += "&iTwinId=${Uri.encode(remoteIds[0])}&iModelId=${Uri.encode(remoteIds[1])}"
            }
        }

        if (isYesEnv("IMJS_IGNORE_CACHE"))
            args += "&ignoreCache=true"

        if (isYesEnv("IMJS_EXIT_AFTER_MODEL_OPENED"))
            exitAfterModelOpened = true

        host.loadEntryPoint(env.optStringNotEmpty("IMJS_DEBUG_URL") ?: "https://${WebViewAssetLoader.DEFAULT_DOMAIN}/index.html", args)
    }

    private fun isYesEnv(name: String): Boolean {
        return env.optString(name) == "YES"
    }

    private fun loadEnvJson() {
        env = try {
            JSONObject(assets.open("www/mobile/env.json").bufferedReader().use { it.readText() })
        } catch (ex: Exception) {
            JSONObject()
        }
    }

    override fun onResume() {
        host.onResume()
        super.onResume()
    }

    override fun onPause() {
        host.onPause()
        super.onPause()
    }
}