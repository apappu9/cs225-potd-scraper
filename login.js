const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: path.resolve(__dirname, 'browser_data'), // saves cookies and other browser data in here (to preserve login)
  });

  const [page] = await browser.pages();

  await page.goto('https://prairielearn.engr.illinois.edu/pl/');

  const illinoisIconSelector = '.login-methods img[src="/images/illinois_logo.svg"]';
  const logoutButtonSelector = 'a.btn[href="/pl/logout"]';
  if (await page.$(illinoisIconSelector)) { // not logged in
    await page.click(illinoisIconSelector);
    console.log('Please login manually');

    try {
      // wait for the logout button to appear (indicates successful login)
      await page.waitForSelector(logoutButtonSelector, { timeout: 10 * 60 * 1000 });
      console.log("Successfully logged in! Please run 'npm run scrape' to scrape POTDs")
    } catch {
      console.log('Failed to login in time, please try again');
    }
  } else { // already logged in
    console.log("You're already logged in. Please run 'npm run scrape' to scrape POTDs");
  }

  await browser.close();
})()