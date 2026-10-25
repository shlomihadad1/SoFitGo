package com.sofitgo.beta;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * SoFitGo beta — Android test app. Shows the bundled web build (assets/www) from https://appassets.androidplatform.net/,
 * so the page is a secure context, starts offline and keeps its data (localStorage / IndexedDB) in the app's private storage.
 * Updating the app with a build signed by the same key keeps that data; uninstalling removes it (export first).
 * The bridge (window.SoFitGoAndroid) only saves files into Downloads and keeps the screen on during a workout.
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/assets/www/index.html";
    static final int REQ_FILE = 1, REQ_GEO = 2;
    WebView web;
    ValueCallback<Uri[]> fileCb;
    String geoOrigin;
    GeolocationPermissions.Callback geoCb;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setSupportMultipleWindows(false);
        s.setGeolocationEnabled(true);
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return loader.shouldInterceptRequest(r.getUrl());
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false; // the app itself
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException e) { /* no app for the link */ }
                return true; // every other link (maps, legal sources, mail) opens outside the app
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try { startActivityForResult(p.createIntent(), REQ_FILE); } catch (ActivityNotFoundException e) { fileCb = null; return false; }
                return true;
            }
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (!HOST.equals(Uri.parse(origin).getHost())) { cb.invoke(origin, false, false); return; }
                if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) { cb.invoke(origin, true, false); return; }
                geoOrigin = origin; geoCb = cb; // asked only now, when the user tapped a location button in the app
                requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_GEO);
            }
        });
        web.addJavascriptInterface(new Bridge(), "SoFitGoAndroid");
        if (saved != null) web.restoreState(saved); else web.loadUrl(START);
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onPause() { super.onPause(); web.onPause(); }   // the page gets visibilitychange → the workout saves its last-seen time
    @Override protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE && fileCb != null) { fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data)); fileCb = null; return; }
        super.onActivityResult(req, res, data);
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] grants) {
        if (req == REQ_GEO && geoCb != null) {
            boolean ok = grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED;
            geoCb.invoke(geoOrigin, ok, false); geoCb = null; geoOrigin = null;
        }
    }

    /** window.SoFitGoAndroid — the only native functions the page can call. */
    class Bridge {
        /** Saves a text file (CSV / JSON backup / .ics) into Downloads. Returns "ok:<where>" or "error:<reason>". */
        @JavascriptInterface
        public String saveFile(String name, String mime, String text) {
            String safe = name == null ? "sofitgo.txt" : name.replaceAll("[^A-Za-z0-9._-]", "_");
            if (safe.isEmpty() || safe.length() > 120) safe = "sofitgo.txt";
            byte[] bytes = (text == null ? "" : text).getBytes(StandardCharsets.UTF_8);
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                    cv.put(MediaStore.Downloads.MIME_TYPE, mime == null ? "text/plain" : mime);
                    cv.put(MediaStore.Downloads.IS_PENDING, 1);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) return "error:לא ניתן ליצור קובץ בתיקיית ההורדות";
                    try (OutputStream o = getContentResolver().openOutputStream(uri)) { if (o == null) return "error:לא ניתן לכתוב"; o.write(bytes); }
                    cv.clear(); cv.put(MediaStore.Downloads.IS_PENDING, 0); getContentResolver().update(uri, cv, null, null);
                    return "ok:הורדות/" + safe;
                }
                File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS); // Android 7–9: the app's own folder, no permission needed
                if (dir == null) return "error:אין אחסון זמין";
                File f = new File(dir, safe);
                try (FileOutputStream o = new FileOutputStream(f)) { o.write(bytes); }
                return "ok:" + f.getAbsolutePath();
            } catch (Exception e) {
                return "error:" + e.getMessage();
            }
        }

        /** Keeps the screen on while a workout is open (the page asks for it only when its "keep screen on" setting is on). */
        @JavascriptInterface
        public void keepScreenOn(final boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }
    }
}
