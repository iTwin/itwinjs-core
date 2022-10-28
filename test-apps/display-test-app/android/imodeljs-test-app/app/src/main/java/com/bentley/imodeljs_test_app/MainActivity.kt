package com.bentley.imodeljs_test_app

import android.os.Bundle
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import com.bentley.itwin.IModelJsHost
import com.bentley.itwin.MobileFrontend

class MainActivity : AppCompatActivity() {
    lateinit var host: IModelJsHost

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(true)
        val alwaysExtractAssets = true // for debugging, otherwise the host will only extract when app version changes
        host = IModelJsHost(this, alwaysExtractAssets, true)
        host.startup()
        val frontend: MobileFrontend = object : MobileFrontend(host, "&standalone=true&iModelName=${filesDir.path}/JoesHouse.bim") {
            override fun supplyEntryPoint(): String {
                // If you want to connect to a local dev server instead of the built-in frontend, return something like: "192.168.86.20:3000"
                return super.supplyEntryPoint()
            }
        }
        host.setFrontend(frontend)
        setContentView(frontend)
        frontend.loadEntryPoint()
    }

    override fun onPause() {
        super.onPause()
        host.onPause()
    }

    override fun onResume() {
        super.onResume()
        host.onResume()
    }
}