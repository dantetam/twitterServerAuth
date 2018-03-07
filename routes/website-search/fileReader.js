var readline = require('readline');
var fs = require('fs');
var textract = require('textract');

var self = {

  exploreFiles: function(dir) {
    return walkSync(dir, []);
  },

  //Sourced from https://gist.github.com/kethinov/6658166
  //A synchronous, recursive traversal of a file structure.
  walkSync: function(dir, filelist) {
    var files = fs.readdirSync(dir);
    filelist = filelist || [];
    files.forEach(function(file) {
      if (fs.statSync(dir + file).isDirectory()) {
        filelist = walkSync(dir + file + '/', filelist);
      }
      else {
        filelist.push(file);
      }
    });
    return filelist;
  },

  getContentHtmlDir: function(htmlDir) {
    var files = self.exploreFiles(htmlDir);
    var result = [];

    for (var fileName of files) {
      fs.readFile(fileName, { encoding: 'utf8' }, function (err, data) {
        console.log(data);
        var indexedData = {index: fileName, data: data};
        result.push(indexedData);
      });
    }
  },

  getTextFromFile: function(filePath, next) {
    textract.fromFileWithPath(filePath, function( error, text ) {
      if (error) {
        throw error;
      }
      next(text);
    });
  }

};

module.exports = self;
