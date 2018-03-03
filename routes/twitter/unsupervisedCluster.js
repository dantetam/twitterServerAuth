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
    if (word.length < 2) {
      next(null, null);
      return;
    };
    var firstTwoLetters = word.substring(0,2);

    var lineReader = readline.createInterface({
      input: fs.createReadStream(word2vecDir + firstTwoLetters + ".txt")
    });

    let success = false;

    lineReader.on('line', function (line) {
      if (line.startsWith(word + " ")) { //We are looking for just the word, not words with matching prefixes
        //Succeeded, parse line into an array of numbers, call callback
        var vectorString = line.substring(word.length + 1).trim();
        //console.log(">" + vectorString + "<");
        var tokens = vectorString.split(" ");
        var vector = tokens.map(parseFloat);
        success = true;
        lineReader.close();
        next(null, vector);
        return;
      }
    });

    //Failed. Still call the callback to indicate this task has been finished
    lineReader.on('close', function () {
      if (!success) {
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
        if (vectors.length === 0) return null;
        if (vectors.length === 1) return vectors[0];
        var result = vectors[0];
        var numVectors = 1;
        for (let i = 1; i < vectors.length; i++) { //Average all non-null vectors together
          if (vectors[i] === null) continue;
          numVectors++;
          for (let j = 0; j < vectors[i].length; j++) {
            result[j] += vectors[i][j];
          }
        }
        for (let i = 0; i < result.length; i++) {
          result[i] /= numVectors;
        }
        console.log(result.length);
      }
    );
  },

  cosineSimilarity: function(vecA, vecB) {
    if (vecA.length !== vecB.length) throw new Error("Cannot compute cos. similiarity of two unequal length vectors");
    var dotProduct = 0;
    var magA = 0, magB = 0;
    for (var i = 0; i < vecA.length; i++) {
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
      dotProduct = vecA[i] * vecB[i];
    }
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);
    return dotProduct / (magA * magB);
  }

};

console.log("Executing clustering code");

self.getVectorFromSentence(["this", "is", "a", "sentence"], null);

module.exports = self;
