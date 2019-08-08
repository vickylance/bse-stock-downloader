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

let downloadStocksList = () => {
  return new Promise((resolve, reject) => {
    download(
      `https://www.quandl.com/api/v3/databases/BSE/metadata?api_key=${
        process.env.QUANT_API_KEY
      }`
    )
      .then(data => {
        console.log("StockList zip file downloaded!");
        writeFile(STOCK_LIST, data).then(() => {
          console.log("StockList zip file written to disk!");
          resolve(data);
        })
        .catch(err => {
          if (err) reject(err);
        });
      })
      .catch(err => {
        if (err) reject(err);
      });
  });
};

let checkAndDownloadStocksList = () => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(path.resolve(__dirname, STOCK_LIST))) {
      console.log("StockList zip already present");
      resolve(true);
    } else {
      console.log("StockList file not found downloading...");
      downloadStocksList()
        .then(() => {
          resolve(true);
        })
        .catch(err => {
          if (err) reject(err);
        });
    }
  });
};

let checkAndExtractStocksList = () => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(path.resolve(__dirname, "./BSE_metadata.csv"))) {
      console.log("StockList csv file already present");
      resolve(true);
    } else {
      checkAndDownloadStocksList()
        .then(() => {
          extractP(STOCK_LIST, { dir: path.resolve(__dirname, "./") })
            .then(() => {
              resolve(true);
              console.log("StocksList file extracted!");
            })
            .catch(err => {
              if (err) reject(err);
            });
        })
        .catch(err => {
          if (err) reject(err);
        });
    }
  });
};

let downloadStockData = code => {
  return new Promise((resolve, reject) => {
    download(
      `https://www.quandl.com/api/v3/datasets/BSE/${code}.csv?api_key=${
        process.env.QUANT_API_KEY
      }`
    )
      .then(data => {
        console.log(`${code}.csv file downloaded.`);
        writeFile(path.resolve(__dirname, "downloads", `${code}.csv`), data)
          .then(() => {
            console.log(`${code}.csv file written to disk.`);
            resolve(true);
          })
          .catch(err => {
            if (err) {
              reject(err);
            }
          });
      })
      .catch(err => {
        if (err) {
          reject(err);
        }
      });
  });
};

let checkAndDownloadStockData = code => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(path.resolve(__dirname, "downloads2", `./${code}.csv`))) {
      resolve(true);
    } else {
      downloadStockData(code)
        .then(() => {
          resolve(true);
        })
        .catch(err => {
          if (err) {
            reject(err);
          }
        });
    }
  });
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
          await checkAndDownloadStockData(results[current].code);
        } catch (err) {
          if (err) {
            console.error(err);
          }
        }
        if (current <= max) {
          current++;
          console.log(`${results[current].code} file downloaded!`);
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

let getFileCnt = require("./count-files");
let path = require("path");
let chokidar = require("chokidar");

const watcher = chokidar.watch(path.resolve(__dirname, "downloads"), {
  persistent: true
});
const log = console.log.bind(console);
watcher.on("add", changedpath => {
  log(
    `File ${changedpath} has been added. Total count is now: ${getFileCnt(
      path.resolve(__dirname, "downloads")
    )}`
  );
});
