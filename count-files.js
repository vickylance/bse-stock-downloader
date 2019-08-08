const fs = require('fs');

const getFilesCount = (path) => fs.readdirSync(path).length;

module.exports = getFilesCount;