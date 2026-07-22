package com.tnyfood.notadigital;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

@CapacitorPlugin(name = "ReceiptDownloader")
public class ReceiptDownloaderPlugin extends Plugin {
    @PluginMethod
    public void savePng(PluginCall call) {
        String fileName = call.getString("fileName", "nota.png");
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("Data gambar tidak tersedia");
            return;
        }

        try {
            String base64Data = data.contains(",") ? data.substring(data.indexOf(',') + 1) : data;
            byte[] imageBytes = Base64.decode(base64Data, Base64.DEFAULT);
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "image/png");

            Uri collection;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            } else {
                collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
            }

            Uri uri = getContext().getContentResolver().insert(collection, values);
            if (uri == null) {
                call.reject("Folder Download tidak dapat diakses");
                return;
            }
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri)) {
                if (output == null) {
                    call.reject("File gambar tidak dapat dibuat");
                    return;
                }
                output.write(imageBytes);
            }
            call.resolve(new com.getcapacitor.JSObject().put("uri", uri.toString()));
        } catch (Exception error) {
            call.reject("Gagal menyimpan gambar nota", error);
        }
    }
}
