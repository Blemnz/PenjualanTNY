package com.tnyfood.notadigital;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(ReceiptDownloaderPlugin.class);
        registerPlugin(ThermalPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
