/**
This module collects all methods which read vector files for computing word2vec/sentiment data.
This uses async io to read many files at a time.

TODO: Fix async IO so it does not fail when reading too many files at once, i.e. the famous error,
"Error: EMFILE, too many open files"
*/

var readline = require('readline');
var fs = require('fs');
var async = require("async");

var word2vecDir = "./word2vec/";
var vaderSentimentFile = "./vaderSentiment/vader_lexicon.txt";

var self = module.exports = {

  /**
  Async. look through word2vec files for the respective word vector for the given word,
  then call the _next_ callback, whether or not successful.
  */
  getWordVec: function(word, next) {
    if (word.trim().length < 2) {
      next(null, null);
      return;
    };
    var firstTwoLetters = word.substring(0,2);
    var path = word2vecDir + firstTwoLetters + ".txt";
    if (!firstTwoLetters.match(/^[a-z]+$/i) || !fs.existsSync(path)) { //Make sure that the first two characters are letters only
      next(null, null);
      return;
    }

    var lineReader = readline.createInterface({
      input: fs.createReadStream(path)
    });

    let success = false;

    lineReader.on('line', function (line) {
      if (line.startsWith(word + " ")) { //We are looking for just the word, not words with matching prefixes
        //Succeeded, parse line into an array of numbers, call callback
        var vectorString = line.substring(word.length + 1).trim();
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

  /**
  Async. run multiple vector retrieval I/O functions to get vectors for all words in a sentence,
  and then average them, as a rough word embedding heuristic.
  */
  getAveragedVectorFromSentence: function(sentenceTokens, next) {
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
        if (vectors.length === 0) {next(null, null); return;}
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
        next(null, result);
      }
    );
  },

  /**
  Async. run multiple vector retrieval I/O functions to get vectors for all words in a sentence,
  and then compile them into a 2d array of numbers (1d array of vectors).
  */
  getFullVectorFromSentence: function(sentenceTokens, next) {
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
        for (var i = vectors.length - 1; i >= 0; i--) {
          if (vectors[i] === null) {
            vectors.splice(i, 1);
          }
        }
        next(null, vectors);
      }
    );
  },

  /**
  Wait for all sentences to be transformed into vectors, and then return execute a callback with the results.
  */
  sentenceGroupGetVectors: function(doubleArrSentenceTokens, next) {
    var vecLookups = [];
    for (let sentenceTokens of doubleArrSentenceTokens) {
      let vecLookup = function(next) {
        self.getFullVectorFromSentence(sentenceTokens, next);
      };
      vecLookups.push(vecLookup);
    }

    async.parallel(
      vecLookups,
      function(err, sentenceVectors) { //Final callback after parallel execution
        if (err) {
          console.log(err);
          throw err;
        }
        //console.log(sentenceVectors);
        next(null, sentenceVectors);
      }
    );
  },

  /**
  Async. look through VADER sentiment file for the respective polarity vector for the given word,
  then call the _next_ callback, whether or not successful.

  This vector is in the format [polarity, intensity].
  */
  getSentimentVec: function(word, next) {
    //Read in the txt file at the location defined (declared at the top of this file)
    var path = vaderSentimentFile;
    if (!fs.existsSync(path)) {
      next(null, null);
      return;
    }
    var lineReader = readline.createInterface({
      input: fs.createReadStream(path)
    });

    let success = false;

    //Note that the VADER sentiment file is formatted with tabs
    lineReader.on('line', function (line) {
      if (line.startsWith(word + "\t")) { //We are looking for just the word, not words with matching prefixes
        //Succeeded, parse line into an array of numbers, call callback
        var vectorString = line.substring(word.length + 1).trim();
        var tokens = vectorString.split("\t");
        var vector = [+tokens[0], +tokens[1]];
        success = true;
        lineReader.close();
        next(null, vector);
        return;
      }
    });

    //Failed. Still call the callback to indicate this task has been finished
    lineReader.on('close', function () {
      if (!success) {
        next(null, [0, 0]);
      }
    });
  },

  /**
  Async. run multiple vector retrieval I/O functions to get sentiment for all words in a sentence,
  and then compile them into a 2d array of numbers (1d array of vectors).
  */
  getFullSentimentFromSentence: function(sentenceTokens, next) {
    var vecLookups = [];
    for (let token of sentenceTokens) {
      let vecLookup = function(next) {
        self.getSentimentVec(token, next);
      };
      vecLookups.push(vecLookup);
    }

    async.parallel(
      vecLookups,
      function(err, vectors) { //Final callback after parallel execution
        if (err) throw err;
        for (var i = vectors.length - 1; i >= 0; i--) {
          if (vectors[i] === null) {
            vectors.splice(i, 1);
          }
        }
        next(null, vectors);
      }
    );
  },

  getAvgSentimentFromSentence: function(sentenceTokens, next) {
    var vecLookups = [];
    for (let token of sentenceTokens) {
      let vecLookup = function(next) {
        self.getSentimentVec(token, next);
      };
      vecLookups.push(vecLookup);
    }

    async.parallel(
      vecLookups,
      function(err, vectors) { //Final callback after parallel execution
        if (err) throw err;
        var result = [0, 0];
        for (var i = vectors.length - 1; i >= 0; i--) {
          if (vectors[i] === null) {
            vectors.splice(i, 1);
          }
          else {
            result[0] += vectors[i][0] * vectors[i][1];
            result[1] += vectors[i][1];
          }
        }
        if (vectors.length !== 0) result[1] /= vectors.length;
        next(null, result);
      }
    );
  },

  /**
  Wait for all sentences to be transformed into vectors, and then return execute a callback with the results.
  */
  sentenceGroupGetSentiment: function(doubleArrSentenceTokens, callback) {
    var vecLookups = [];
    for (let sentenceTokens of doubleArrSentenceTokens) {
      let vecLookup = function(next) {
        self.getFullSentimentFromSentence(sentenceTokens, next);
      };
      vecLookups.push(vecLookup);
    }

    async.parallel(
      vecLookups,
      function(err, sentenceVectors) { //Final callback after parallel execution
        if (err) throw err;
        var results = {polarity: [], intensity: [], sentenceTokens: doubleArrSentenceTokens};
        for (var sentenceVector of sentenceVectors) {
          var averagedSentiment = 0;
          var totalWeights = 0;
          for (var wordVector of sentenceVector) {
            averagedSentiment += wordVector[0] * wordVector[1];
            totalWeights += wordVector[1];
          }
          var weightedAvg = 0;
          if (totalWeights > 0) weightedAvg = averagedSentiment / totalWeights;
          var avgIntensity = totalWeights / sentenceVector.length;
          results.polarity.push(weightedAvg);
          results.intensity.push(avgIntensity);
        }
        callback(null, results);
      }
    );
  }
};
