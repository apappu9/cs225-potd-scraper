const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const puppeteer = require('puppeteer');
const prompt = require('prompt');

const HEADLESS = true; // set this to false to watch the browser as it scrapes

main();

async function main() {
  // create a folder called 'potds' (this is where everything will be donwloaded to)
  try {
    await fs.promises.mkdir('potds');
  } catch(e) {
    // folder already exists, we don't need to do anything
  };

  // Windows can't run shell scripts by default, but assuming git is installed, it should come with a copy of unix commands
  let unixCommandsPath = '';
  try {
    if (os.platform() == 'win32') {
      unixCommandsPath = await getUnixCommandsPath();
    }
  } catch(e) {
    console.log("Error: Please make sure you have git installed and it's added to PATH");
    return;
  }

  const browser = await puppeteer.launch({
    headless: HEADLESS,
  });

  const [page] = await browser.pages();

  // attempt to login
  try {
    await login(page);
  } catch(e) {
    console.log(e);
    browser.close();
    return;
  }

  const alreadyScrapedPOTDs = new Set(await fs.promises.readdir(path.resolve(__dirname, 'potds')));

  await page.goto('https://prairielearn.engr.illinois.edu/pl/');

  const cs225CourseLinks = await page.$x("//a[contains(text(), 'CS 225')]");
  if (cs225CourseLinks.length !== 1) {
    console.log(`Error: You're either not logged in, not enrolled in CS 225, or enrolled in multiple CS 225s`);
  } else {
    // click on the CS 225 course
    const cs225 = cs225CourseLinks[0];
    await Promise.all([
      cs225.click(),
      page.waitForNavigation(),
    ]);

    // get list of all the problems of the day
    const potdList = await page.$x("//a[contains(text(), 'Problem of the Day')]");
    for (const [i, potd] of potdList.entries()) {
      const potdPage = await browser.newPage();

      try {
        // navigate to the page containing instructions and the download link
        const href = await (await potd.getProperty('href')).jsonValue();
        await potdPage.goto(href);
        await Promise.all([
          potdPage.click('#content .table td a[href^="/pl/course_instance/"]'),
          potdPage.waitForNavigation(),
        ]);

        // set download location to the potds folder
        const potdsPath = path.resolve(__dirname, 'potds');
        await potdPage._client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: potdsPath });

        // find the starter code shell script
        const shellScriptLink = await potdPage.$('a[download]');
        const shellScriptLinkHref = await (await shellScriptLink.getProperty('href')).jsonValue();
        const potdFilename = shellScriptLinkHref.slice(shellScriptLinkHref.lastIndexOf('/') + 1, shellScriptLinkHref.lastIndexOf('.'));

        // skip scraping this potd if we already have it
        if (alreadyScrapedPOTDs.has(potdFilename)) {
          console.log(`Already scraped ${potdFilename}, skipping...`);
        } else {
          // download the shell script
          const shellScriptFilepath = path.resolve(__dirname, 'potds', `${potdFilename}.sh`);
          await Promise.all([
            waitForFile(shellScriptFilepath),
            shellScriptLink.click(),
          ]);

          // run the shell script and delete it
          console.log(await execPromise(`sh ${shellScriptFilepath}`, {
            cwd: potdsPath,
            env: { PATH: `${process.env.PATH}${unixCommandsPath};` }
          }));
          await fs.promises.unlink(shellScriptFilepath);

          // get the instructions content as html and save it to README.md
          const instructionsHTML = await potdPage.$eval('.card-body.question-body', element => (
            element.innerHTML.slice(0, element.innerHTML.indexOf('<h4>Upload Solution</h4>'))
          ));
          await fs.promises.writeFile(path.resolve(__dirname, 'potds', potdFilename, 'README.md'), instructionsHTML);

          // get the instructions content as text and save it to README.txt
          const instructionsText = await potdPage.$eval('.card-body.question-body', element => (
            element.innerText.slice(0, element.innerText.indexOf('Upload Solution'))
          ));
          await fs.promises.writeFile(path.resolve(__dirname, 'potds', potdFilename, 'README.txt'), instructionsText);

          console.log(`Successfully scraped ${potdFilename} to potds/${potdFilename}\n\n`);
        }
      } catch(e) {
        console.log(e);
        console.log(`Failed to scrape POTD #${i + 1}, please try opening the POTD manually and rerunning 'npm run scrape'`);
        console.log("(note: when rerunning, only POTD's that failed to be scraped the previous time will be attempted again.\n\n");
      }

      await potdPage.close();
    }
  }

  console.log('Done.');
  await browser.close();
}

const promptPromise = schema => new Promise((resolve, reject) => {
  prompt.get(schema, (err, result) => {
    if (err) reject(err);
    else resolve(result);
  });
});

async function login(page) {
  await page.goto('https://prairielearn.engr.illinois.edu/pl/');

  const illinoisIconSelector = '.login-methods img[src="/images/illinois_logo.svg"]';
  const logoutButtonSelector = 'a.btn[href="/pl/logout"]';
  if (await page.$(illinoisIconSelector)) { // if not logged in
    await page.click(illinoisIconSelector);

    prompt.start();
    console.log('Please enter your Illinois credentials (note: this is not saved anywhere, check the code):')
    const { username, password } = await promptPromise([{
      name: 'username',
      required: true
    }, {
      name: 'password',
      hidden: true,
      required: true,
    }]);

    await page.type('#j_username', username);
    await page.type('#j_password', password);

    Promise.all([
      page.click('input[type="submit"]'),
      page.waitForNavigation(),
    ]);

    try {
      // wait for the logout button to appear (indicates successful login)
      await page.waitForSelector(logoutButtonSelector, { timeout: 10 * 60 * 1000 });
      console.log("Successfully logged in!\n");
    } catch {
      throw 'Error: Invalid Credentials';
    }
  }
}

function execPromise(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout);
      }
    });
  });
}

async function getUnixCommandsPath() {
  const gitPath = await execPromise('where git');
  return path.resolve(gitPath.trim(), '../', '../', 'usr', 'bin');
}

function waitForFile(filepath) {
  return new Promise((resolve, reject) => {
    let interval = null, timeout = null;

    timeout = setTimeout(() => {
      clearInterval(interval);
      reject('Timeout')
    }, 60 * 1000); // timeout after 1 minute

    const checkForFile = () => {
      if (fs.existsSync(filepath)) {
        clearInterval(interval);
        clearTimeout(timeout);
        resolve();
      }
    }
    
    interval = setInterval(checkForFile, 500); // check for file every 500ms
    checkForFile();
  });
}