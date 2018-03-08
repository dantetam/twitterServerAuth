/*
Server side unsupervised classification/clustering algorithm for tweets.

This runs an analysis on queried tweets and forms clusters through k-means,
testing the best _k_ (number of clusters) based on the Schwarz criterion:


*/

var readline = require('readline');
var fs = require('fs');
var async = require("async");

var word2vecDir = "./word2vec/";

var DEFAULT_THRESHOLD_SIMILARITY = 1;

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

  //Compute the overlap similiarity score of two possibly unequal length vectors
  overlapScore: function(vecA, vecB) {
    if (vecA.length === 0 || vecB.length === 0) return 0;
    var overlap = {};
    var intersection = 0;
    for (var item of vecA) {
      if (overlap[item] === undefined) overlap[item] = 0;
    }
    for (var item of vecB) {
      if (overlap[item] === 0) intersection++;
    }
    var union = vecA.length + vecB.length - intersection;
    return intersection / union;
  },

  //The "angle" similiarity of two vectors, where 1 represents parallel and 0 represents opposite facing vectors.
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
      result += Math.abs(vecA[i] - vecB[i]);
    }
    return result;
  },

  /**
  Sentence similiarity heuristic: for every word in sentence1, determine its best match, and average the best match for every word.
  */
  sentenceSimilarity: function(sentence1, sentence2) {
    if (sentence1.length === 0 || sentence2.length === 0) return 0;
    var avgMatch = 0;
    for (var wordVector of sentence1) {
      let bestMatch = null;
      for (var otherWordVector of sentence2) {
        var curMatch = self.euclideanDist(wordVector, otherWordVector) - self.cosineSimilarity(wordVector, otherWordVector);
        if (bestMatch === null || curMatch > bestMatch) {
          bestMatch = curMatch;
        }
      }
      avgMatch += bestMatch;
    }
    return avgMatch / sentence1.length;
  },

  /**
  Measure the group diversity/similiarity index of a group of tweets.
  Ideally the tweets only contain important content words and proper nouns.
  */
  /*
  sentenceGroupSimilarity: function(sentences, thresholdSimilarity) {

  },
  */

  /**
  Front facing methods for taking in processed tweets and returning the desired result:
  a series of cluster approximations;
  a minimum spanning tree using the sentence distance metrics above;
  or, a naive grouping by proper nouns (possibly the most effective).
  */
  testCluster: function(doubleArrTokens, next) {
    var callback = function(err, sentenceVectors) {
      var clusters = self.approxCluster(sentenceVectors, self.sentenceSimilarity);
      if (next) next(null, clusters);
    }
    self.sentenceGroupGetVectors(doubleArrTokens, callback);
  },

  testMst: function(doubleArrTokens, next) {
    var callback = function(err, sentenceVectors) {
      var clusters = self.mstSentenceVectors(sentenceVectors, self.sentenceSimilarity);
      if (next) next(null, clusters);
    }
    self.sentenceGroupGetVectors(doubleArrTokens, callback);
  },

  testProperNounTopicGrouping: function(properNounTokens) {
    var results = approxCluster(properNounTokens, self.overlapScore);
    return results;
  },

  /**

  */
  approxCluster: function(sentenceVectors, metric) {
    var visited = {}; //Pick some initial cluster centroids to start with
    var n = sentenceVectors.length; //Number of points

    var distMatrix = self.getVecDistMatrix(sentenceVectors, metric);
    var randomChoicesPerIter = 10;
    var thresholdSimilarity = DEFAULT_THRESHOLD_SIMILARITY;

    var clusters = [];
    var alreadyChosen = 0;

    while (alreadyChosen < n) { //While there are still points not in a cluster
      var startClusters = [];
      for (var i = 0; i < randomChoicesPerIter; i++) { //Choose random points to start new clusters
        while (true) {
          var index = Math.floor(Math.random() * n);
          if (visited[index] === undefined) {
            visited[index] = true;
            startClusters.push(index);
            alreadyChosen++;
            break;
          }
          if (alreadyChosen === n) {
            break;
          }
        }
      }

      for (var index of startClusters) { //Create new clusters from unvisited points
        //var startPoint = sentenceVectors[index];
        var cluster = {
          center: index,
          points: [index],
          active: true
        }

        var fringe = [{point: index, radius: thresholdSimilarity}];
        //This is a traversal starting from the center point,
        //decreasing the radius every generation onward from the center.
        //The radius can be increased up to its parent radius if the parent cluster contains more points.
        while (fringe.length > 0) {
          var firstNode = fringe.splice(0, 1)[0];
          var inspectIndex = firstNode.point;
          var addToFringe = []; //Collect all new nodes, so we can set their properties, and then add them to the fringe
          for (var otherIndex = 0; otherIndex < n; otherIndex++) { //Fill the new cluster with neighboring unvisited points
            if (visited[otherIndex]) continue;
            if (distMatrix[inspectIndex][otherIndex] <= thresholdSimilarity) {
              visited[otherIndex] = true;
              alreadyChosen++;
              cluster.points.push(otherIndex);
              addToFringe.push({point: otherIndex, radius: "TBD"});
            }
          }
          for (var newNode of addToFringe) {
            newNode.radius = Math.min(firstNode.radius * 0.8, firstNode.radius * (0.6 + addToFringe.length / 30));
            fringe.push(newNode);
          }
        }
        console.log(cluster.points);
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
            console.log("Merging " + i + " : " + j)
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
        if (!clusters[i].active) {
          clusters.splice(i, 1);
        }
      }
    }

    return clusters;
  },

  mstSentenceVectors: function(sentenceVectors, metric) {
    var visited = {};
    var n = sentenceVectors.length; //Number of points

    var distMatrix = self.getVecDistMatrix(sentenceVectors, metric);
    var arrEdges = [];
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (i === j) continue;
        arrEdges.push({i: i, j: j, edge: distMatrix[i][j]});
      }
    }

    arrEdges.sort(function(a, b) {
      return a.edge - b.edge;
    });

    var result = [];

    while (result.length < n + 1 && arrEdges.length > 0) {
      var firstEdge = arrEdges.splice(0, 1)[0];
      //console.log(result);
      var i = firstEdge["i"], j = firstEdge["j"];
      if (visited[i] === undefined || visited[j] === undefined) {
        //console.log(firstEdge);
        visited[i] = true;
        visited[j] = true;
        result.push([i, j]);
      }
    }

    console.log(result);

    return result;
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
      if (data[x] === true) {
        results.push(x);
      }
    }
    return {"matchingObj": data, "matchingNum": results.length};
  },

  getVecDistMatrix: function(sentenceVectors, metric) {
    if (metric === undefined) {
      throw Error("No sentence similiarity metric given for getVecDistMatrix()");
    }
    var n = sentenceVectors.length;
    var result = new Array(n);
    for (var i = 0; i < n; i++) {
      result[i] = new Array(n);
    }
    for (var i = 0; i < n; i++) {
      for (var j = i; j < n; j++) {
        if (i === j) continue;
        result[i][j] = metric(sentenceVectors[i], sentenceVectors[j]);
        result[j][i] = result[i][j];
      }
    }
    return result;
  }

};

console.log("Executing clustering code");

//self.getVectorFromSentence(["this", "is", "a", "sentence", "prefix", "preempt", "preserve"], null);
//self.sentenceGroupGetVectors([["this", "is", "a", "sentence", "prefix", "preempt", "preserve"], ["this", "is", "yet", "another", "sentence"]]);
//self.testCluster([["this", "is", "a", "sentence", "prefix", "preempt", "preserve"], ["this", "is", "yet", "another", "sentence"], ["sentence", "prevent", "stop", "is"], ["unrelated", "melon", "kiwi"]]);
//self.testCluster([["sentence", "prefix", "preempt", "preserve"], ["another", "sentence"], ["sentence", "prevent", "stop"], ["unrelated", "melon", "kiwi"]]);

self.testCluster([["apple", "orange", "banana"], ["apple", "tangerine", "grape"], ["bird", "raven", "crow"], ["pigeon", "seagull", "albatross"]], null);

module.exports = self;
