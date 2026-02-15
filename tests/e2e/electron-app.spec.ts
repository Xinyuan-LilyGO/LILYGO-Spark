import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Electron App', () => {
  let electronApp: any;

  test.beforeEach(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist-electron/main.js')],
      executablePath: require('electron'), // Use the electron package to get the path
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should launch the application', async () => {
    const window = await electronApp.firstWindow();
    const title = await window.title();
    expect(title).toBeDefined(); 
  });

  test('should navigate to Firmware Dumper and verify UI', async () => {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Try to find the link by text, supporting multiple languages
    const dumperText = /从设备提取固件|Firmware Dumper/;
    const dumperLink = window.getByText(dumperText).first();
    
    if (await dumperLink.isVisible()) {
        await dumperLink.click();
    }

    // Verify Dumper UI elements
    const infoText = /设备信息|Device Info/;
    await expect(window.getByText(infoText)).toBeVisible();
  });

  test('should handle file selection in Burner', async () => {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Create a dummy bin file for testing
    const dummyBinPath = path.join(__dirname, 'test-firmware.bin');
    fs.writeFileSync(dummyBinPath, 'dummy content');

    try {
        // Find the file input in Burner component
        // It might be hidden, so we need to be careful
        // In Burner.tsx: <input type="file" ... className="hidden" ... />
        
        // We can target it by type="file"
        const fileInput = window.locator('input[type="file"]').first();
        
        // Upload the file
        await fileInput.setInputFiles(dummyBinPath);

        // Verify that the file name appears in the UI
        // The UI shows the file name after selection
        await expect(window.getByText('test-firmware.bin')).toBeVisible();

        // Verify that we can click "Start Flashing" (or "开始刷写")
        // This button might be disabled if no port is selected, but we just check visibility/existence
        const flashBtnText = /开始刷写|Start Flashing/;
        await expect(window.getByText(flashBtnText)).toBeVisible();

    } finally {
        // Cleanup
        if (fs.existsSync(dummyBinPath)) {
            fs.unlinkSync(dummyBinPath);
        }
    }
  });
});
