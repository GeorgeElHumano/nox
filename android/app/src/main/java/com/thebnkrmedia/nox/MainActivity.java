package com.thebnkrmedia.nox;

import android.app.Activity;
import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** NOX para Android: abre el juego online a pantalla completa. Se actualiza solo con cada cambio del sitio. */
public class MainActivity extends Activity {
    static final String HOME = "https://noxparaguay.com/jugar/";
    private WebView web;
    private PermissionRequest pending;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(15, 11, 9));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setUserAgentString(s.getUserAgentString() + " NOXAndroid/" + BuildConfigVersion.NAME);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String host = u.getHost() == null ? "" : u.getHost();
                if (host.endsWith("noxparaguay.pages.dev") || host.endsWith("noxparaguay.com")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest req) {
                // el juego pide el micrófono solo para el chat de voz del grupo
                boolean mic = false;
                for (String r : req.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) mic = true;
                if (!mic) { req.deny(); return; }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    req.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                } else { pending = req; requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 7); }
            }
        });
        setContentView(web);
        hideBars();
        if (state != null) web.restoreState(state); else web.loadUrl(HOME);
    }

    private void hideBars() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        if (code != 7 || pending == null) return;
        if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) pending.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        else pending.deny();
        pending = null;
    }

    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) hideBars(); }
    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
}
