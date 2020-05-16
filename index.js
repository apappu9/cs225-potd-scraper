const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // set this to false to watch the browser as it scrapes
    userDataDir: path.resolve(__dirname, 'browser_data'),
  });

  const [page] = await browser.pages();
  

  await page.goto('https://prairielearn.engr.illinois.edu/pl/');

  const cs225CourseLinks = await page.$x("//a[contains(text(), 'CS 225')]");
  if (cs225CourseLinks.length !== 1) {
    console.log(`Error: You're either not logged in, not enrolled in CS 225, or enrolled in multiple CS 225s`);
  } else {
    const cs225 = cs225CourseLinks[0];
    await Promise.all([
      cs225.click(),
      page.waitForNavigation()
    ]);

    const potdList = await page.$x("//a[contains(text(), 'Problem of the Day')]");
    for (const potd of potdList) {
      const href = await (await potd.getProperty('href')).jsonValue();
      console.log(href);
    }
    await page.waitFor(10 * 1000);
  }

  await browser.close();
})();