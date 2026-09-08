package com.tnyfood.notadigital;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.OutputStream;
import java.nio.charset.Charset;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name = "ThermalPrinter", permissions = {
    @Permission(alias = "bluetooth", strings = {Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN})
})
public class ThermalPrinterPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    @PluginMethod
    public void requestBluetoothPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || getPermissionState("bluetooth") == PermissionState.GRANTED) {
            call.resolve();
            return;
        }
        requestPermissionForAlias("bluetooth", call, "bluetoothPermissionResult");
    }

    @PermissionCallback
    private void bluetoothPermissionResult(PluginCall call) {
        if (getPermissionState("bluetooth") == PermissionState.GRANTED) call.resolve();
        else call.reject("Izin Bluetooth diperlukan untuk printer thermal");
    }

    @PluginMethod
    public void listPairedDevices(PluginCall call) {
        if (!hasBluetoothPermission(call)) return;
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || !adapter.isEnabled()) { call.reject("Bluetooth tidak aktif"); return; }
        try {
            Set<BluetoothDevice> devices = adapter.getBondedDevices();
            JSArray result = new JSArray();
            for (BluetoothDevice device : devices) {
                JSObject item = new JSObject();
                item.put("name", device.getName() == null ? "Perangkat tanpa nama" : device.getName());
                item.put("address", device.getAddress());
                result.put(item);
            }
            JSObject response = new JSObject();
            response.put("devices", result);
            call.resolve(response);
        } catch (SecurityException error) { call.reject("Izin Bluetooth tidak tersedia", error); }
    }

    @PluginMethod
    public void print(PluginCall call) {
        if (!hasBluetoothPermission(call)) return;
        String address = call.getString("address");
        String text = call.getString("text", "");
        if (address == null || address.isEmpty()) { call.reject("Alamat printer belum dipilih"); return; }
        new Thread(() -> printReceipt(call, address, text)).start();
    }

    private boolean hasBluetoothPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Izin Bluetooth diperlukan"); return false;
        }
        return true;
    }

    private void printReceipt(PluginCall call, String address, String text) {
        BluetoothSocket socket = null;
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) throw new IllegalStateException("Bluetooth tidak aktif");
            BluetoothDevice device = adapter.getRemoteDevice(address);
            adapter.cancelDiscovery();
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            OutputStream output = socket.getOutputStream();
            
            // ESC @ (Initialize printer)
            output.write(new byte[] {0x1B, 0x40});
            // FS & (Enable Chinese mode) & FS C 1 (Set GBK character code)
            output.write(new byte[] {0x1C, 0x26, 0x1C, 0x43, 0x01});
            
            // Encode string using GBK character set
            output.write(text.replace("\n", "\r\n").getBytes(Charset.forName("GBK")));
            
            // Paper feed & cut
            output.write(new byte[] {0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x00});
            output.flush();
            call.resolve();
        } catch (Exception error) { call.reject("Tidak dapat mencetak ke printer: " + error.getMessage(), error); }
        finally { if (socket != null) try { socket.close(); } catch (Exception ignored) { } }
    }
}
