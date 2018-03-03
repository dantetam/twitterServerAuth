/*
Server side unsupervised classification/clustering algorithm for tweets.

This runs an analysis on queried tweets and forms clusters through k-means,
testing the best _k_ (number of clusters) based on the Schwarz criterion:


*/

var readline = require('readline');
var fs = require('fs');
var async = require("async");

var word2vecDir = "./word2vec/";

var self = {

  /**
  Async. look through word2vec files for the respective word vector for the given word,
  then call the _next_ callback, whether or not successful.
  */
  getWordVec: function(word, next) {
    if (word.length < 2) return null;
    var firstTwoLetters = word.substring(0,2);

    var lineReader = readline.createInterface({
      input: fs.createReadStream(word2vecDir + firstTwoLetters + ".txt")
    });

    var success = false;

    lineReader.on('line', function (line) {
      if (line.startsWith(word + " ")) { //We are looking for just the word, not words with matching prefixes
        //Succeeded, parse line into an array of numbers, call callback
        var vectorString = line.substring(word.length + 1).trim();
        var tokens = line.split(" ");
        var vector = tokens.map(parseFloat);
        success = true;
        lineReader.close();
        console.log("Succeeded " + word);
        next(null, vector);
        return;
      }
    });

    //Failed. Still call the callback to indicate this task has been finished
    lineReader.on('close', function () {
      if (!success) {
        console.log("Failed " + word);
        next(null, null);
      }
    });
  },

  getVectorFromSentence: function(sentenceTokens) {
    var vecLookups = [];
    for (let token of sentenceTokens) {
      let vecLookup = function(next) {
        self.getWordVec(token, next);
      };
      vecLookups.push(vecLookup);
    }

    async.parallel(
      vecLookups,
      function(err, vectors) { //Final callback after parallel execution
        if (err) {
          throw err;
        }
        console.log(vectors);
      }
    );
  }

};

console.log("Executing clustering code");

self.getVectorFromSentence(["This", "is", "sentence"], null);

module.exports = self;
