require("dotenv").config();

const request = require("request");
const fs = require("fs");
const extract = require("extract-zip");
const path = require("path");
const csv = require("csv-parser");
const download = require("download");
const util = require("util");

const writeFile = util.promisify(fs.writeFile);
const access = util.promisify(fs.access);
const extractP = util.promisify(extract);

const STOCK_LIST = "BSE_Stock_List.zip";

let checkAndDownloadStocksList = async () => {
  try {
    return await access(path.resolve(__dirname, STOCK_LIST), fs.F_OK);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      console.log("StockList file not found downloading...");
      let fileDownload = await download(
        `https://www.quandl.com/api/v3/databases/BSE/metadata?api_key=${
          process.env.QUANT_API_KEY
        }`
      );
      await writeFile(STOCK_LIST, fileDownload);
      console.log("StockList file downloaded!");
    }
  }
};

let checkAndExtractStocksList = async () => {
  try {
    return await access(path.resolve(__dirname, "./BSE_metadata.csv"), fs.F_OK);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      await checkAndDownloadStocksList();
      await extractP(STOCK_LIST, { dir: path.resolve(__dirname, "./") });
      console.log("File extracted!");
    }
  }
};

let downloadStockData = async code => {
  try {
    let fileDownload = await download(
      `https://www.quandl.com/api/v3/datasets/BSE/${code}.csv?api_key=${
        process.env.QUANT_API_KEY
      }`
    );
    await writeFile(
      path.resolve(__dirname, "downloads", `${code}.csv`),
      fileDownload
    );
  } catch (err) {
    if(err) {
      console.error(err);
      return;
    }
  }
}

let checkAndDownloadStocksData = async code => {
  try {
    console.log("Current Code: ", code);
    return await access(
      path.resolve(__dirname, "downloads", `./${code}.csv`),
      fs.F_OK
    );
  } catch (err) {
    if (err && err.code === "ENOENT") {
      downloadStockData(code);
    }
  }
};

function doSynchronousLoop(data, processData, done) {
  if (data.length > 0) {
    var loop = function(data, i, processData, done) {
      processData(data[i], i, function() {
        if (++i < data.length) {
          setTimeout(function() {
            loop(data, i, processData, done);
          }, 0);
        } else {
          done();
        }
      });
    };
    loop(data, 0, processData, done);
  } else {
    done();
  }
}

checkAndExtractStocksList().then(() => {
  console.log("All Data downloaded");
  let results = [];
  fs.createReadStream("./BSE_metadata.csv")
    .pipe(csv())
    .on("data", data => results.push(data))
    .on("end", () => {
      let max = results.length - 1;
      let current = 0;
      let x = setInterval(async () => {
        try {
          await checkAndDownloadStocksData(results[current].code);
        } catch(err) {
          if(err) {
            console.error(err);
          }
        } 
        if(current <= max) {
          current++;
          console.log(`${results[current].code} file downloaded!`)
        } else {
          clearInterval(x);
        }
      }, 1000);
    });
});

// const downloadAndUnzip = (url, zipName, options) => {
//   request(url)
//     .pipe(fs.createWriteStream(zipName))
//     .on("close", function() {
//       console.log("File written!" + zipName);
//       extract(
//         zipName,
//         { dir: path.resolve(__dirname, options.target || "./") },
//         function(err) {
//           if (err) {
//             console.error(err);
//             return;
//           }
//           console.log("File extracted!");
//         }
//       );
//     });
// };

// const download = (url, zipName) => {
//   request(url)
//     .pipe(fs.createWriteStream(path.resolve(__dirname, 'downloads', zipName)))
//     .on("close", function() {
//       console.log("File written!" + zipName);
//     });
// };

// if(!fs.existsSync('./BSE_metadata.csv')) { // if the file does not exist then download it.
//   downloadAndUnzip(
//     `https://www.quandl.com/api/v3/databases/BSE/metadata?api_key=${
//       process.env.QUANT_API_KEY
//     }`,
//     "./BSE_Stock_List.zip",
//     { target: "./" }
//   );
// }

// let results = [];
// fs.createReadStream('./BSE_metadata.csv')
//   .pipe(csv())
//   .on('data', (data) => results.push(data))
//   .on('end', () => {
//     console.log(results)
//     results.map(data => {
//       download(`https://www.quandl.com/api/v3/datasets/BSE/${data.code}.csv?api_key=${process.env.QUANT_API_KEY}`, `${data.code}.csv`)
//     })
//   });
