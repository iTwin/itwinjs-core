package com.bentley.imodeljs_test_app;

import androidx.appcompat.app.AppCompatActivity;
import android.os.Bundle;
import android.webkit.WebView;
import com.bentley.itwin.IModelJsHost;
import com.bentley.itwin.MobileFrontend;

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
            protected String supplyEntryPoint() {
                return super.supplyEntryPoint();
//                return "192.168.86.20:3000";
            }
        };
        m_host.setFrontend(frontend);
        setContentView(frontend);
        frontend.loadEntryPoint();
        int port = m_host.getPort();
        if (port == 9229) {
            port = port + 0;
        }
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