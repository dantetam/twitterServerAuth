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

  /*
  kMeansClustering: function(data, numClusters) {
    var chosenRandomIndices = {}; //Pick some initial cluster centroids to start with
    var n = data.length; //Number of points
    for (var i = 0; i < numClusters; i++) {
      while (true) {
        var index = Math.random() * n;
        if (chosenRandomIndices[index] === undefined) {
          chosenRandomIndices[index] = true;
          break;
        }
      }
    }
    var clusterCenters = [];

    for (var kMeansIter = 0; kMeansIter < 10; kMeansIter++) {
      var clusters = [];
      for (var index in chosenRandomIndices) {
        var dataPoint = data[index];
        clusterCenters.push(dataPoint);
        clusters.push([]);
      }
      for (var i = 0; i < n; i++) {
        for (var j = 0; j < numClusters; j++) {

        }
      }
    }
  },

  optimalClustering: function(data) {

  },
  */

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
  },

  euclideanDist: function(vecA, vecB) {
    if (vecA.length !== vecB.length) throw new Error("Cannot compute distance of two unequal length vectors");
    var result = 0;
    for (var i = 0; i < vecA.length; i++) {
      let diff = vecA[i] - vecB[i];
      result += diff * diff;
    }
    return Math.sqrt(result);
  },

  manhattanDist: function(vecA, vecB) {
    if (vecA.length !== vecB.length) throw new Error("Cannot compute distance of two unequal length vectors");
    var result = 0;
    for (var i = 0; i < vecA.length; i++) {
      result += vecA[i] - vecB[i];
    }
    return result;
  },

  /**
  Measure the group diversity/similiarity index of a group of tweets.
  Ideally the tweets only contain important content words and proper nouns.
  */
  sentenceGroupSimilarity: function(sentences, thresholdSimilarity) {

  },

  /**

  */
  approxCluster: function(sentenceVectors) {
    var visited = {}; //Pick some initial cluster centroids to start with
    var n = sentenceVectors.length; //Number of points

    var distMatrix = self.getVecDistMatrix(sentenceVectors, thresholdSimilarity);

    var randomChoicesPerIter = 10;

    var clusters = [];

    var alreadyChosen = 0;

    while (alreadyChosen < n) { //While there are still points not in a cluster
      //var startClusters = [];

      for (var i = 0; i < randomChoices; i++) { //Choose random points to start new clusters
        while (true) {
          var index = Math.floor(Math.random() * n);
          if (visited[index] === undefined) {
            visited[index] = true;
            //startClusters.push(index);
            alreadyChosen++;
            break;
          }
        }
      }
      for (var index of startClusters) { //Create new clusters from unvisited points
        var startPoint = sentenceVectors[index];
        var cluster = {
          center: index,
          points: [index],
          active: true
        }
        for (var otherIndex = 0; otherIndex < n; otherIndex++) { //Fill the new cluster with neighboring unvisited points
          if (visited[otherIndex]) continue;
          if (distMatrix[index][otherIndex] <= thresholdSimilarity) {
            visited[otherIndex] = true;
            alreadyChosen++;
            cluster.points.push(otherIndex);
          }
        }
        clusters.push(cluster);
      }


      //Merge clusters if they are close enough. This is satisfied by one or both of these conditions:
      //the clusters overlap significantly;
      //the clusters are close enough and small enough.
      for (var i = 0; i < clusters.length; i++) {
        for (var j = i; j < clusters.length; j++) {
          if (i === j || !clusters[i].active || !clusters[j].active) continue;
          var matchingData = self.getMatch(clusters[i].points, clusters[j].points);
          var matchingObj = matchingData["matchingObj"];
          var matchingNum = matchingData["matchingNum"];
          var percentMatch = matchingNum / Math.min(clusters[i].points.length, clusters[j].points.length);
          if (percentMatch >= 0.6) {
            for (var otherIndex of clusters[j].points) {
              if (matchingObj[otherIndex] === true) {
                continue;
              }
              clusters[i].points.push(otherIndex); //Add second cluster points that are not already in first cluster
              clusters[j].active = false;
            }
          }
        }
      }

      //Remove inactive clusters
      for (var i = clusters.length - 1; i >= 0; i--) {
        if (clusters[i].active) {
          clusters.splice(i, 1);
        }
      }

    }
    var clusterCenters = [];
  },

  getMatch: function(arrA, arrB) {
    var data = {};
    for (var x of arrA) {
      data[x] = false;
    }
    for (var x of arrB) {
      if (data[x] === false) {
        data[x] = true;
      }
    }
    var results = [];
    for (var x in data) {
      results.push(x);
    }
    return {"matchingObj": data, "matchingNum": results.length};
  },

  getVecDistMatrix: function(sentenceVectors) {
    var n = sentenceVectors.length;
    var result = new Array(n);
    for (var i = 0; i < n; i++) {
      result[i] = new Array(n);
    }
    for (var i = 0; i < n; i++) {
      for (var j = i; j < n; j++) {
        if (i === j) continue;
        result[i][j] = self.euclideanDist(sentenceVectors[i], sentenceVectors[j]);
        result[j][i] = result[i][j];
      }
    }
    return result;
  }

};

console.log("Executing clustering code");

self.getVectorFromSentence(["this", "is", "a", "sentence", "prefix", "preempt", "preserve"], null);

module.exports = self;
