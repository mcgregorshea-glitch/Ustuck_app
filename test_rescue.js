const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:8080/index.html');

    // Enable toggle
    await page.click('#btn-settings');
    await page.waitForTimeout(500);

    const isEnabled = await page.evaluate(() => document.getElementById('toggle-rescue').checked);
    if (!isEnabled) {
        await page.click('.toggle-slider'); // enable rescue
    }

    // Click 5 sec test pill
    await page.click('[data-delay="0.0833"]');

    // Close settings
    await page.click('#settings-close');
    await page.waitForTimeout(500);

    // Add task
    await page.click('#btn-vault-shortcut');
    await page.waitForTimeout(500);
    await page.fill('#vault-input', 'Test Task 1');
    await page.press('#vault-input', 'Enter');
    await page.waitForTimeout(200);
    await page.fill('#vault-input', 'Test Task 2');
    await page.press('#vault-input', 'Enter');

    await page.click('#btn-back');
    await page.waitForTimeout(500);

    // Simulate tab hide by opening a new tab
    console.log("Hiding tab by opening a new one...");
    const blankPage = await context.newPage();
    await blankPage.goto('about:blank');

    await page.waitForTimeout(6000); // Wait 6 seconds (more than 5s limit)

    // Navigate back to original tab
    console.log("Switching back to original tab...");
    await blankPage.close();
    await page.bringToFront();

    // Wait to see if reveal automatically fires
    await page.waitForTimeout(1000);

    // Check if we are on reveal screen
    const isReveal = await page.evaluate(() => {
        return document.getElementById('screen-reveal').classList.contains('active');
    });

    console.log("Is reveal active automatically?", isReveal);

    if (isReveal) {
        const text = await page.textContent('#reveal-task-text');
        console.log("Task revealed:", text);

        // Test the Later button
        console.log("Clicking 'Later'");
        await page.click('#btn-snooze');
        await page.waitForTimeout(1000); // Wait for the new animation and text replace

        const nextText = await page.textContent('#reveal-task-text');
        console.log("Next task after Later:", nextText);
    }

    await browser.close();
})();
