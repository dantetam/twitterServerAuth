/*
Server side unsupervised classification/clustering algorithm for tweets.

The intention of this code is to develop automatic and beautiful clusterings of tweets.
We accomplish this clustering through the use of approximation clustering algorithms
(which may find local minima in terms of cluster 'fit'),
and smart distance heuristics as well as vectorizations.

One of the greatest insights is that the distance function used, defines the way in which
data tends to cluster, as well as the relationships between groups of data, and what comprises
those groups of data.

See approxClusterDistDensity(...); for the approximated, more efficient clustering algorithm.
Basic vector similiarity functions are used as a proof of concept.
More sophisticated measures, such as latent vector representation,
are done offline.

PROPOSED: run an analysis on queried tweets and forms clusters through k-means,
testing the best _k_ (number of clusters) based on the Schwarz criterion.
The Schwarz criterion (or Bayesian information criterion, BIC), briefly,
is a generalized measure of the "fit" of an inferred model. In the case of k-means,
an algorithm using the Schwarz criterion would try to minimize these two measurements:

minarg_C [W(C) + lambda * m * k * log R]
where C is some valid clustering/partition;

W(C), within-class scatter, i.e. the standard deviation of every cluster; and
lambda * m * k * log R, the number of free parameters, or model complexity.

For a source and detailed explanation, see
https://datascience.stackexchange.com/questions/9177/how-is-the-schwarz-criterion-defined/9218
*/

var readline = require('readline');
var fs = require('fs');
var async = require("async");

var metrics = require("../math/metrics");
var util = require("../../util.js");
var vecLookup = require("./vecLookup.js");

var DEFAULT_THRESHOLD_SIMILARITY = 3.5;
var DEFAULT_TOPIC_MATCHING_LIMIT = 0.25;

var self = {

  /**
  Measure the group 'similiarity' index of a group of tweets.
  Ideally the tweets only contain important content words and proper nouns.
  This method uses the concept of "average linkage", i.e.
  */
  sentenceGroupSimilarity: function(sentenceVectors, metric, similiarityLimitFunc) {
    var distMatrix = getVecDistMatrix(sentenceVectors, metric);
    var avgLinkage = 0;
    if (distMatrix.length === 0 || distMatrix[0].length === 0) return 0;
    for (var i = 0; i < distMatrix.length; i++) {
      for (var j = 0; j < distMatrix[0].length; j++) {
        if (i <= j) continue;
        avgLinkage += distMatrix[i][j];
      }
    }
    return avgLinkage / (distMatrix.length * distMatrix[0].length / 2);
  },

  /**
  Front facing methods for taking in processed tweets and returning the desired result:
  a series of cluster approximations;
  a minimum spanning tree using the sentence distance metrics above;
  or, a naive grouping by proper nouns (possibly the most effective).
  */
  testSentiment: function(doubleArrSentenceTokens) {
    var callback = function(err, results) {console.log(results);}
    vecLookup.sentenceGroupGetSentiment(doubleArrSentenceTokens, callback);
  },
  testCluster: function(doubleArrTokens, next) {
    var callback = function(err, sentenceVectors) {
      var clusters = self.approxClusterDistDensity(sentenceVectors, metrics.sentenceSimilarity, function(x) {return x < DEFAULT_THRESHOLD_SIMILARITY;});
      var diversity = metrics.modifiedShannonIndex(clusters);
      console.log("Shannon Diversity Index: " + diversity);
      if (next) next(null, clusters);
    }
    vecLookup.sentenceGroupGetVectors(doubleArrTokens, callback);
  },
  testMst: function(doubleArrTokens, next) {
    var callback = function(err, sentenceVectors) {
      var clusters = self.mstSentenceVectors(sentenceVectors, metrics.sentenceSimilarity);
      if (next) next(null, clusters);
    }
    vecLookup.sentenceGroupGetVectors(doubleArrTokens, callback);
  },
  testProperNounTopicGrouping: function(properNounTokens) {
    var results = self.approxClusterDistDensity(properNounTokens, metrics.overlapScore, function(x) {return x > DEFAULT_TOPIC_MATCHING_LIMIT;});
    return results;
  },

  /**
  This algorithm works with sentence vectors (either word2vec or word tokens) to produce sensible cluster approximations quickly.
  This works by "seeding" some initial cluster start points,
  expanding around the cluster points to populate new clusters,
  and merge clusters if there is enough overlap between shared points.

  @param sentenceVectors The double array of either tokens or numbers, representing sentences
  @param metric A function which takes in two vectors and returns some kind of distance
  @param similiarityLimitFunc A function which returns true or false on a numbered condition (like > 0.3)
  */
  approxClusterDistDensity: function(sentenceVectors, metric, similiarityLimitFunc) {
    var visited = {}; //Pick some initial cluster centroids to start with
    var n = sentenceVectors.length; //Number of points

    var distMatrix = self.getVecDistMatrix(sentenceVectors, metric);
    var randomChoicesPerIter = Math.floor(n / 10);

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

        var fringe = [{point: index, radius: 0}];
        //This is a traversal starting from the center point,
        //decreasing the radius every generation onward from the center.
        //The radius can be increased up to its parent radius if the parent cluster contains more points.
        while (fringe.length > 0) {
          var firstNode = fringe.splice(0, 1)[0];
          var inspectIndex = firstNode.point;
          var addToFringe = []; //Collect all new nodes, so we can set their properties, and then add them to the fringe
          for (var otherIndex = 0; otherIndex < n; otherIndex++) { //Fill the new cluster with neighboring unvisited points
            if (visited[otherIndex]) continue;
            if (similiarityLimitFunc(distMatrix[inspectIndex][otherIndex])) {
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
        //console.log(cluster.points);
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
            //console.log("Merging " + i + " : " + j)
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

  approxClusterIncompleteMST: function(properNounTokens) {
    var distMatrix = self.getVecDistMatrix(properNounTokens, metrics.overlapScore);
    return self._computeMstFromDistMatrix(distMatrix, 0.2);
  },

  //Construct a minimum spanning tree through Kruskal's algorithm of sentence vectors using a custom distance metric.
  mstSentenceVectors: function(sentenceVectors, metric) {
    var distMatrix = self.getVecDistMatrix(sentenceVectors, metric);
    return self._computeMstFromDistMatrix(distMatrix);
  },

  //Return an MST with edges greater than length _edgeLowerBound_ removed.
  _computeMstFromDistMatrix: function(distMatrix, edgeLowerBound = undefined) {
    var visited = {};
    var n = sentenceVectors.length; //Number of points

    var arrEdges = [];
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (i === j) continue;
        arrEdges.push({i: i, j: j, edgeLength: distMatrix[i][j]});
      }
    }

    arrEdges.sort(function(a, b) { //Descending sort
      return b.edge - a.edge;
    });

    var result = [];

    while (result.length < n + 1 && arrEdges.length > 0) {
      var firstEdge = arrEdges.splice(0, 1)[0];
      if (edgeLowerBound && firstEdge.edgeLength <= edgeLowerBound) break; //Separate parts of the MST optimally to create clusters
      var i = firstEdge["i"], j = firstEdge["j"];
      if (visited[i] === undefined || visited[j] === undefined) {
        visited[i] = true;
        visited[j] = true;
        result.push([i, j]);
      }
    }

    return result;
  },

  //Return the set intersection and intersection length of two arrays
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

  /**
  For an array of sentence vectors of length n,
  create a matrix of size n by n,
  where matrix[i,j] is the distance metric(vec_i, vec_j),
  and where matrix[i,i] is undefined.
  */
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
  },

  /**
  Given a two dimensional array _properNounTokens_,
  return a dictionary of the most common associations,
  indexed by word i.e.
  ["a", "b", "c"]

  Note that since sentences are limited to a certain number of proper noun tokens, say _s_,
  the actual runtime of this method is ns^2 + n(s log s) = O(ns^2),
  where n is the number of sentences.
  */
  findAssocFromProperNouns: function(properNounTokens) {
    var results = {};
    for (let arrTokens of properNounTokens) {
      for (var i = 0; i < arrTokens.length; i++) {
        let firstToken = arrTokens[i];
        for (var j = 0; j < arrTokens.length; j++) {
          if (i === j) continue;
          let secondToken = arrTokens[j];
          if (results[firstToken] === undefined) {
            results[firstToken] = {};
          }
          if (results[firstToken][secondToken] === undefined) {
            results[firstToken][secondToken] = 0;
          }
          results[firstToken][secondToken]++;
        }
      }
    }
    //Below, we convert every object within the results into a sorted array.
    /*
    i.e.
    {"a":
      {
      "b": 5, //implies the pair "a" & "b" is seen five times together
      "c": 4
      },
     "b": {...}
    }
    ->
    {"a": [["b", 5], ["c", 4]], "b": [...]}
    */
    var sortedWithinKeyResults = {};
    for (let token in results) {
      sortedWithinKeyResults[token] = util.sortDictIntoList(results[token], 0);
    }
    return sortedWithinKeyResults;
  },

  /**
  @param properNounSet A list of proper nouns, with no repeats
  @param topicAssoc A dictionary indexed by words, and values are like the output of
    self.findAssocFromProperNouns() i.e. "a": [["b", 5], ["c", 4]]
  @param wordCountDict A dictionary of word counts indexed by word
  @param proportionLinkMin The minimum proportion from [0,1] at which a Bayesian (count(A,B) / count(A))
    MLE determines a possible match between A and B
    Note for now: add 1 to count(A,B) if and only if A and B appear in the same tweet.
  @param minCountCutoff The minimum count(A,B) which fires a match between A and B
  @return The connected components as a two dimensional array of proper nouns

  Notes: Use 0.35, 5 for normal matching;
  0.20 - 0.25, 3 for looser association;
  and 0.4, 9 for conservative matching.
  */

  groupAssociatedTerms: function(properNounSet, topicAssoc, wordCountDict, proportionLinkMin = 0.20, minCountCutoff = 3) {
    var edges = {}; //List of all topics that can be linked together, undirected edges
    for (let token of properNounSet) {
      edges[token] = [];
      var associatedTokens = topicAssoc[token];
      var totalCount = wordCountDict[token];
      if (associatedTokens === undefined) continue; //No word matches found
      for (let entry of associatedTokens) {
        var otherToken = entry[0], count = entry[1];
        if (count / totalCount >= proportionLinkMin && count >= minCountCutoff) {
          edges[token].push(otherToken);
        }
        else { //Counts are sorted, so if this element is lower than the minimum proportion,
          //the other elements to the right are smaller and are also not qualified.
          break;
        }
      }
    }
    //Convert the list of edges into connected components through depth first search
    return self.dfsFindConnectedComponents(properNounSet, edges);
  },

  /**
  A DFS traversal to isolate connected components in an undirected, and often not connected graph.
  @param vertices A list of vertice names
  @param edges A dictionary of edges indexed by vertex names
  @return The connected components as a two dimensional array of vertex names
  */
  dfsFindConnectedComponents: function(vertices, edges) {
    var components = [];
    var visited = {};
    var counter = -1; //Current index of _components_ array to consider

    var dfs = function(u) {
      var neighbors = edges[u];
      for (let v of neighbors) {
        if (visited[v] === undefined) {
          visited[v] = true;
          components[counter].push(v); //While still on the current component, continue adding to it
          dfs(v);
        }
      }
    };

    for (let u of vertices) {
      if (visited[u] === undefined) {
        visited[u] = true;
        components.push([u]); //Start off a new component with the current element
        counter++;
        dfs(u); //This DFS call will go through this connected component
      }
    }

    //Sort components by total vertex length in descending order
    components.sort(function(a, b) {return b.length - a.length;});
    return components;
  }

};

//vecLookup.getFullVectorFromSentence(["this", "is", "a", "sentence", "prefix", "preempt", "preserve"], null);
//vecLookup.sentenceGroupGetVectors([["this", "is", "a", "sentence", "prefix", "preempt", "preserve"], ["this", "is", "yet", "another", "sentence"]]);
//self.testCluster([["this", "is", "a", "sentence", "prefix", "preempt", "preserve"], ["this", "is", "yet", "another", "sentence"], ["sentence", "prevent", "stop", "is"], ["unrelated", "melon", "kiwi"]]);
//self.testCluster([["sentence", "prefix", "preempt", "preserve"], ["another", "sentence"], ["sentence", "prevent", "stop"], ["unrelated", "melon", "kiwi"]]);

//self.testCluster([["apple", "orange", "banana"], ["apple", "tangerine", "grape"], ["bird", "raven", "crow"], ["pigeon", "seagull", "albatross"]], null);

/*
vecLookup.testSentiment([
  "this is a bad terrible movie".split(" "),
  "exceedingly terrifying and displeasing".split(" "),
  "this is as great as a horror movie can be excellent brilliant".split(" ")
]);
*/

module.exports = self;
