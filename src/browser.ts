import type { Browser, Page } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';

export enum BrowserType {
    CHROMIUM = 'chromium',
    FIREFOX = 'firefox',
    WEBKIT = 'webkit',
}

export type BrowserOptions = {
    browserType?: BrowserType;
};

export type PageOptions = {};

export async function launchBrowser(
    browserOptions: BrowserOptions = {}
): Promise<Browser> {
    // Use the appropriate browser engine
    let browserInstance;
    switch (browserOptions.browserType) {
        case BrowserType.FIREFOX:
            browserInstance = firefox;
            break;
        case BrowserType.WEBKIT:
            browserInstance = webkit;
            break;
        case BrowserType.CHROMIUM:
        default:
            browserInstance = chromium;
            break;
    }
    return browserInstance.launch({
        handleSIGINT: false,
        handleSIGTERM: false,
    });
}

export async function newPage(
    browser: Browser,
    pageOptions: PageOptions = {}
): Promise<Page> {
    return await browser.newPage();
}
