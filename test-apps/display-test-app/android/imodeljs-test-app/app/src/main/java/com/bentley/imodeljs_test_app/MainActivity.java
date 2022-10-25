package com.bentley.imodeljs_test_app;

import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;

import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.bentley.itwin.IModelJsHost;
import com.bentley.itwin.MobileFrontend;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

public class MainActivity extends AppCompatActivity {
    IModelJsHost m_host;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView.setWebContentsDebuggingEnabled(true);

        boolean alwaysExtractAssets = true; // for debugging, otherwise the host will only extract when app version changes
        m_host = new IModelJsHost(this, alwaysExtractAssets, true);
        m_host.startup();

        String files = getFilesDir().getPath();
        MobileFrontend frontend = new MobileFrontend(m_host, "&standalone=true&iModelName=" + files + "/JoesHouse.bim") {
            @Override
            protected void configure() {
                setWebViewClient(new WebViewClient() {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                        Uri url = request.getUrl();
                        if (url.getScheme().equals("file") && url.getPath().endsWith(".js")) {
                            try {
                                InputStream is = getContext().getAssets().open("frontend" + url.getPath(), AssetManager.ACCESS_STREAMING);
                                return new WebResourceResponse("text/plain", null, is);
                            } catch (IOException e) {
                                e.printStackTrace();
                            }
                        }
                        return super.shouldInterceptRequest(view, request);
                    }
                });
                super.configure();
                getSettings().setAllowFileAccess(true);
            }

            @Override
            protected String supplyEntryPoint() {
                String entry = super.supplyEntryPoint();
//                entry = "192.168.86.20:3000";
                return entry;
            }
        };
        m_host.setFrontend(frontend);
        setContentView(frontend);
        frontend.loadEntryPoint();
    }

    @Override
    protected void onPause() {
        super.onPause();
        m_host.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        m_host.onResume();
    }
}