/*
Server side unsupervised classification/clustering algorithm for tweets.

This runs an analysis on queried tweets and forms clusters through k-means,
testing the best _k_ (number of clusters) based on the Schwarz criterion:


*/

var readline = require('readline');
var fs = require('fs');

var word2vecDir = "./word2vec/";

var self = {

  getWordVec: function(word, next) {
    var lineReader = readline.createInterface({
      if (word.length < 2) return null;
      var firstTwoLetters = word.substring(0,2);
      input: fs.createReadStream(word2vecDir + firstTwoLetters + ".txt")
    });

    lineReader.on('line', function (line) {
      if (line.startsWith(word)) {
        var vectorString = line.substring(word.length()).trim();
        var tokens = line.split(" ");
        var vector = tokens.map(parseFloat);
        next(vector);
      }
    });

    lineReader.on('close', function () {

    });
  }

};

self.readWordsFile("./routes/twitter/word-list.txt");

module.exports = self;
