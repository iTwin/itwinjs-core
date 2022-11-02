package com.bentley.imodeljs_test_app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.result.contract.ActivityResultContract
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import com.bentley.itwin.IModelJsHost
import com.bentley.itwin.MobileFrontend
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch


typealias PickUriContractType = ActivityResultContract<Nothing?, Uri?>

class PickUriContract : PickUriContractType() {
    private lateinit var context: Context

    override fun createIntent(context: Context, input: Nothing?): Intent {
        this.context = context
        return Intent()
            .setAction(Intent.ACTION_OPEN_DOCUMENT)
            .setType("*/*")
            .addCategory(Intent.CATEGORY_OPENABLE)
    }

    private fun getDisplayName(uri: Uri): String {
        return FileHelper.getFileDisplayName(uri, context.contentResolver) ?: "unknownDisplayName"
    }

    override fun parseResult(resultCode: Int, intent: Intent?): Uri? {
        val uri = intent?.takeIf { resultCode == Activity.RESULT_OK }?.data
        if (uri != null) {
            val destDir = "bim_cache"
            FileHelper.copyToExternalFiles(context, uri, destDir, getDisplayName(uri))?.let { result ->
                return Uri.parse(result)
            }
        }
        return uri
    }
}

class MainActivity : AppCompatActivity() {
    private lateinit var host: IModelJsHost
    private var promiseName: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(true)
        val alwaysExtractAssets = true // for debugging, otherwise the host will only extract when app version changes
        host = IModelJsHost(this, alwaysExtractAssets, true)
        host.startup()
        val frontend: MobileFrontend = object : MobileFrontend(host, "&standalone=true") {
            override fun supplyEntryPoint(): String {
                // If you want to connect to a local dev server instead of the built-in frontend, return something like: "192.168.86.20:3000"
                return "https://appassets.androidplatform.net/assets/frontend/index.html"
            }
        }

        // using a WebViewAssetLoader so that the localization json files load properly
        // the version of i18next-http-backend we're using tries to use the fetch API with file URL's (apparently fixed in a newer version)
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        frontend.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }
        }

        val startPickDocument = registerForActivityResult(PickUriContract()) { uri ->
            if (uri != null && promiseName.isNotEmpty()) {
                val js = "if (window.$promiseName) window.$promiseName(\"$uri\"); else console.log('Error: window.$promiseName is not defined!');"
                MainScope().launch {
                    frontend.evaluateJavascript(js, null)
                }
            }
        }

        frontend.addJavascriptInterface(
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
                    println("iModel opened: $modelName")
                }
            }, "DTA_Android")

        host.setFrontend(frontend)
        setContentView(frontend)
        frontend.loadEntryPoint()
    }

//    override fun onPause() {
//        host.onPause()
//        super.onPause()
//    }
//
//    override fun onResume() {
//        host.onResume()
//        super.onResume()
//    }
}