#!/usr/bin/env node

var fs = require("fs");

fs.readFile('package.json',
  function(err, data) {
    var jsonData = data;
    var jsonParsed = JSON.parse(jsonData);
    var data = "export const VERSION = \"" + jsonParsed.version + "\";";
    //console.log(data);
    fs.writeFile('src/version.ts', data, (err) => {
      if (err) throw err;
      console.log('The version file has been saved!');
    });
});
