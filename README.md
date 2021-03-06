# CS 225 POTD Scraper
This project uses [Puppeteer](https://pptr.dev) to scrape the starter code and instructions for the Problems of the Day from the CS 225 PrairieLearn.

After running the program, the POTD starter code is saved in the folder `potds/potd-q[num]`. The instructions are saved as a [Markdown](https://en.wikipedia.org/wiki/Markdown) file in `potds/potd-q[num]/README.md`. Note that this file actually just contains a bunch of html, so you need a Markdown viewer to properly read this file. If you don't care about nicely formatted instructions, they're also saved as a plain text file in `potds/potd-q[num]/README.txt`.

The program will check which problems of the day have already been downloaded and only scrape the ones that haven't yet, so feel free to run it again if new POTDs are published.

This has only been briefly tested on Windows 10, so if you encounter any errors, please open an issue on GitHub.

## How to run
Make sure you have [Node.js](https://nodejs.org) installed.
If you're using Windows, you must also have [git](https://git-scm.com/downloads) installed (git comes with a bunch of unix command implementations that allow for running .sh files on windows)

Run `npm install` first to install dependencies.

Then run `node .` (equivalent to `node index.js`)

If you want to watch the browser as it scrapes, set the `HEADLESS` variable in `index.js` to `false`.

