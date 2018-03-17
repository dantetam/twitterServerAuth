var express = require('express');
var async = require('async');
var router = express.Router();
var MongoClient = require('mongodb').MongoClient;

var twitterAnalysis = require('./twitter_analysis.js');
var Tweet = require("../../models/tweet");
var cluster = require('./unsupervisedCluster.js');
var d3Visualization = require('./d3-visualization.js');

var SMALL_QUERY_LIMIT = 100;
var DEFAULT_QUERY_LIMIT = 500;
var LARGE_QUERY_LIMIT = 10000;

//TODO: Merge all the query tweets async/promises into a uniform method for querying tweets,
//and then custom callbacks to handle the results differently per use case.

function connectToTweetData(next) {
  //connect to MongoDB, initiate callback onConnection, using new mongoDB 3.0 client syntax
  var url = "mongodb://localhost:27017/";
  MongoClient.connect(url, function(err, client) {   //Return the mongoDB client obj
    //The client object encompasses the whole database
    if (err) throw err;
    next(null, client);
  });
}


function testVisual(response) {
  d3Visualization.testVisualization(response);
}


function queryUniqueTweetsTest(beginDate, endData, callback) {
  var query = {};
  var dataInclude = {author: 1, text: 1, creationTime: 1};
  if (queryString && queryString.length > 0) query['text'] = new RegExp(queryString, 'i');
  if (beginDate && endDate) {
    query['creationTime'] = {
      $gte: new Date(beginDate),
      $lt: new Date(endDate)
    };
  }

  var collectedSampleTweets = null;

  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, next) { //Find a not random subsampling of tweets to show
      var dbase = client.db("testForAuth");
      Tweet.group({
          $keyf : function(doc){
              return {
                  key : doc.text.substring(0,1) // extract URL base here
              }
          },
          $reduce : function(curr, result){
              result.count++
          },
          initial : {
              count: 0
          }
      });
    }
  ], function(err, result) {
    if (err) throw err;
    if (callback) {
      callback(null, sentimentData);
    }
  });
}


function queryTweetsSentiment(queryString, beginDate, endDate, callback) {
  var query = {};
  var dataInclude = {author: 1, text: 1, creationTime: 1};
  if (queryString && queryString.length > 0) query['text'] = new RegExp(queryString, 'i');
  if (beginDate && endDate) {
    query['creationTime'] = {
      $gte: new Date(beginDate),
      $lt: new Date(endDate)
    };
  }

  var collectedSampleTweets = null;

  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, next) { //Find a not random subsampling of tweets to show
      var dbase = client.db("testForAuth");
      //console.log(query);
      Tweet.aggregate(
          [
              {$match: query},
              {$project: {_id: 1, text: 1}},
              {"$limit": SMALL_QUERY_LIMIT}
          ],
          function(err, sampleTweets) {
              if (err) throw err;
              collectedSampleTweets = sampleTweets;
              var tweetStrings = sampleTweets.map(function(x) {return x["text"];});
              next(null, tweetStrings);
          }
      );
    },
    function(sampleTweets, next) { //Convert the found tweet objects into a multi-dimensional array of word tokens
      var tweetArrTokens = twitterAnalysis.sanitizeTweets(sampleTweets);
      cluster.sentenceGroupGetSentiment(tweetArrTokens, next);
    }
  ], function(err, sentimentData) {
    if (callback) {
      callback(null, sentimentData);
    }
  });
}


/**
Initiate the following async waterfall:
connect to the MongoDB hosting server;
search for distinct tweets based on a query;
get the proper nouns from the tweets;
cluster the tweets by the proper noun tokens;
and finally, send the clusters in a pretty string format to the response.
*/
function queryTweetsTopicGrouping(beginDate, endDate, response) {
  var query = {};
  var dataInclude = {author: 1, text: 1, creationTime: 1};
  if (beginDate && endDate) {
    query['creationTime'] = {
      $gte: new Date(beginDate),
      $lt: new Date(endDate)
    };
  }

  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, next) { //Find a not random subsampling of tweets to show
      var dbase = client.db("testForAuth");
      Tweet.find().distinct('text', query, function(err, tweetsTextArr) { //Instead of returning the full tweet objects,
        //the callback result 'tweetsTextArr' is an array of strings (tweets).
        if (err) throw err;
        next(null, tweetsTextArr);
      });
    },
    function(tweetsTextArr, next) { //Convert the found tweet objects into a multi-dimensional array of word tokens
      //And also parse the tokens and keep only proper nouns for the clustering algorithm
      var properNounTokens = twitterAnalysis.findProperNounsFromStrings(tweetsTextArr);
      var result = cluster.testProperNounTopicGrouping(properNounTokens);
      next(null, tweetsTextArr, result);
    }
  ], function(err, tweetsTextArr, clusters) {
    var result = twitterAnalysis.stringifyClustersTweets(tweetsTextArr, clusters);
    response.send(result);
  });
}


/**
Initiate the following async waterfall:
connect to the MongoDB hosting server;
search for distinct tweets based on a query;
get the sanitized tweet in the form of tokens;
cluster the tweets by the raw tokens;
and finally, send the clusters in a pretty string format to the response.
*/
function queryTweetsCluster(queryString, beginDate, endDate, response) {
  var query = {};
  var dataInclude = {author: 1, text: 1, creationTime: 1};
  if (queryString && queryString.length > 0) query['text'] = new RegExp(queryString, 'i');
  if (beginDate && endDate) {
    query['creationTime'] = {
      $gte: new Date(beginDate),
      $lt: new Date(endDate)
    };
  }

  var collectedSampleTweets = null;

  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, next) { //Find a not random subsampling of tweets to show
      var dbase = client.db("testForAuth");
      Tweet.aggregate(
          [
              {$match: query},
              {$project: {_id: 1, text: 1}},
              {"$limit": DEFAULT_QUERY_LIMIT}
          ],
          function(err, sampleTweets) {
              if (err) throw err;
              collectedSampleTweets = sampleTweets;
              var tweetStrings = sampleTweets.map(function(x) {return x["text"];});
              next(null, tweetStrings);
          }
      );
    },
    function(sampleTweets, next) { //Convert the found tweet objects into a multi-dimensional array of word tokens
      var tweetArrTokens = twitterAnalysis.sanitizeTweets(sampleTweets);
      console.log(tweetArrTokens.length);
      cluster.testCluster(tweetArrTokens, next);
    }
  ], function(err, clusters) {
    var shannonIndex = cluster.modifiedShannonIndex(clusters);
    response.write("Modified Shannon Index (Diversity Index): " + shannonIndex + "\n \n \n");
    var tweetClusters = twitterAnalysis.stringifyClustersTweets(collectedSampleTweets, clusters);
    response.end(JSON.stringify(tweetClusters));
  });
}

/**
Initiate the following async waterfall:
connect to the MongoDB hosting server;
search for all tweets within the given times;
get the sanitized tweet in the form of tokens;
use an MST algorithm and a distance metric to create edges of a tree;
and send the tree in a stringified format to the response.
*/
function queryTweetsMst(queryString, beginDate, endDate, response) {
  var query = {};
  var dataInclude = {author: 1, text: 1, creationTime: 1};
  if (queryString && queryString.length > 0) query['text'] = new RegExp(queryString, 'i');
  if (beginDate && endDate) {
    query['creationTime'] = {
      $gte: new Date(beginDate),
      $lt: new Date(endDate)
    };
  }

  var collectedSampleTweets = null;

  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, next) { //Find a not random subsampling of tweets to show
      var dbase = client.db("testForAuth");
      Tweet.aggregate(
          [
              {$match: query},
              {$project: {_id: 1, text: 1}},
              {"$limit": DEFAULT_QUERY_LIMIT}
          ],
          function(err, results) {
              collectedSampleTweets = results; //Store results for later use out of scope
              next(null, results);
          }
      );
    },
    function(sampleTweets, next) { //Convert the found tweet objects into a multi-dimensional array of word tokens
      var tweetsTextArr = [];
      for (var tweet of sampleTweets) {
        tweetsTextArr.push(tweet["text"]);
      }
      var tweetArrTokens = twitterAnalysis.sanitizeTweets(tweetsTextArr);
      next(null, tweetArrTokens);
    },
    function(tweetArrTokens, next) { //Use the Twitter analysis to convert word tokens -> vector embeddings -> clusters.
      cluster.testMst(tweetArrTokens, next);
    }
  ], function(err, mst) {
    var result = [];
    for (var i = 0; i < mst.length; i++) {
      var edgeString = "Edge " + i + ": ";
      var firstIndex = mst[i][0];
      var secondIndex = mst[i][1];
      edgeString += collectedSampleTweets[firstIndex]["text"] + " <-------> " + collectedSampleTweets[secondIndex]["text"];
      result.push(edgeString);
    }

    //result.push("MST contains cycle: " + cluster.graphContainsCycle(mst));
    response.send(result);
  });
}


function queryTweetsPredict(queryString, inspectWord, beginDate, endDate, next) {
  var query = {};
  var dataInclude = {author: 1, text: 1, creationTime: 1};
  if (queryString && queryString.length > 0) query['text'] = new RegExp(queryString, 'i');
  if (beginDate && endDate) {
    query['creationTime'] = {
      $gte: new Date(beginDate),
      $lt: new Date(endDate)
    };
  }

  var collectedSampleTweets = null;

  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, next) { //Find a not random subsampling of tweets to show
      var dbase = client.db("testForAuth");
      Tweet.aggregate(
          [
              {$match: query},
              {$project: {_id: 1, text: 1}},
              {"$limit": DEFAULT_QUERY_LIMIT}
          ],
          function(err, results) {
              collectedSampleTweets = results; //Store results for later use out of scope
              next(null, results);
          }
      );
    },
    function(sampleTweets, next) { //Convert the found tweet objects into a multi-dimensional array of word tokens
      var tweetsTextArr = [];
      for (var tweet of sampleTweets) {
        tweetsTextArr.push(tweet["text"]);
      }
      var tweetArrTokens = twitterAnalysis.sanitizeTweets(tweetsTextArr);
      next(null, tweetArrTokens);
    },
    function(tweetArrTokens, next) { //Use the Twitter analysis to convert word tokens -> vector embeddings -> clusters.
      var bigramCounts = twitterAnalysis.bigramCounter(tweetArrTokens, inspectWord);
      console.log(bigramCounts);
      next(null, bigramCounts);
    }
  ], function(err, result) {
    if (err) {
      throw err;
    }
    //response.send(result);
    if (next) {
      next(null, result);
    }
  });
}


function queryDataSearchParam(queryString, beginDate, endDate, response, outputMode) {
  var query = {};
  if (queryString && queryString.length > 0) query['text'] = new RegExp(queryString, 'i');
  if (beginDate && endDate) {
    query['creationTime'] = {
      $gte: new Date(beginDate),
      $lt: new Date(endDate)
    };
  }
  queryData(query, response, outputMode);
}

/**
Query up some recently stored tweets according to the parameters of the query,
and send these tweets to the response. The output mode defaults to JSON,
with an option for text.
*/
function queryData(query, response, outputMode) {
  var dataInclude = {author: 1, text: 1, creationTime: 1};

  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, next) { //Find a not random subsampling of tweets to show
      var dbase = client.db("testForAuth");
      dbase.collection("tweets").find(query, dataInclude).limit(DEFAULT_QUERY_LIMIT).toArray(function(err, sampleTweets) {
        if (err) throw err;
        next(null, client, sampleTweets);
      });
    },
    function(client, sampleTweets, next) {
      var dbase = client.db("testForAuth");
      dbase.collection("tweets").find(query, dataInclude).toArray(function(err, result) {
        if (err) throw err;
        client.close();
        var queryCount = result.length;
        next(null, sampleTweets, queryCount);
      });
    },
    function(sampleTweets, queryCount, next) {
      Tweet.count({}, function (err, totalCount) {
        next(err, sampleTweets, queryCount, totalCount);
      });
    }
  ], function(err, sampleTweets, queryCount, totalCount) {
    if (err) {
      console.log(err);
    }
    if (outputMode === "text") {
      var tweetsNumShown = Math.min(queryCount, DEFAULT_QUERY_LIMIT);
      response.write("Total Tweets Found: " + queryCount + " out of " + totalCount + " (" + tweetsNumShown + " shown) \n \n \n");
      response.write(JSON.stringify(sampleTweets));
      response.end();
    }
    else {
      response.send(sampleTweets);
    }
  });
}


function queryLotsOfTweets(response) {
  var dataInclude = {author: 1, text: 1, creationTime: 1};
  var query = {};
  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, next) { //Find a not random subsampling of tweets to show
      var dbase = client.db("testForAuth");
      dbase.collection("tweets").find(query, dataInclude).limit(LARGE_QUERY_LIMIT).toArray(function(err, sampleTweets) {
        if (err) throw err;
        client.close();
        next(null, sampleTweets);
      });
    }
  ], function(err, sampleTweets) {
    if (err) {
      console.log(err);
    }
    var tweetStrings = [];
    for (var tweet of sampleTweets) {
      tweetStrings.push(tweet["text"]);
    }
    var wordCounts = twitterAnalysis.getWordCountFromTweets(tweetStrings, 4); //Get the word count of all words
    response.render('tweetWordCount', {wordCounts: JSON.stringify(wordCounts)});
  });
}


router.get('/wordlookup/:searchTweetWord/:inspectWord', function(req, res, next) {
  var queryString = req.params["searchTweetWord"];
  var inspectWord = req.params["inspectWord"];

  /*
  var currentDate = new Date();
  var previousDate = new Date();
  previousDate.setHours(currentDate.getHours() - 24);
  */

  var callback = function(err, bigramCounts) {
    res.send(bigramCounts);
  };
  queryTweetsPredict(queryString, inspectWord, null, null, callback);
});


router.get('/wordmap', function(req, res, next) {
  queryLotsOfTweets(res);
});


//Test querying the database by time; get most recent tweets
//i.e. /twitterData/recent
router.get('/recent', function(req, res, next) {
  var currentDate = new Date();
  var previousDate = new Date();
  previousDate.setHours(currentDate.getHours() - 24);

  var jsonMode = req.query.output;

  queryDataSearchParam("", previousDate.toJSON(), currentDate.toJSON(), res, jsonMode);
  //res.send("Twitter data test query custom: " + userTopic);
});


router.get('/recentmst', function(req, res, next) {
  var currentDate = new Date();
  var previousDate = new Date();
  previousDate.setHours(currentDate.getHours() - 24);

  queryTweetsMst("", previousDate.toJSON(), currentDate.toJSON(), res);
  //res.send("Twitter data test query custom: " + userTopic);
});


router.get('/recentcluster', function(req, res, next) {
  var currentDate = new Date();
  var previousDate = new Date();
  previousDate.setHours(currentDate.getHours() - 24);

  queryTweetsCluster("", previousDate.toJSON(), currentDate.toJSON(), res);
  //res.send("Twitter data test query custom: " + userTopic);
});


router.get('/recentsentiment', function(req, res, next) {
  var userTopic = req.params["topic"];
  process.env.CURRENT_TOPIC = userTopic;

  var currentDate = new Date();
  var previousDate = new Date();
  previousDate.setHours(currentDate.getHours() - 24);

  var firstCallback = function(err, result) {
    //This sends the word counts to the client, which are rendered by d3.js in the browser.
    res.render('tweetSentimentPlot', {sentimentData: JSON.stringify(result)});
  };

  queryTweetsSentiment("", previousDate.toJSON(), currentDate.toJSON(), firstCallback);
});


router.get('/topicgroups', function(req, res, next) {
  var currentDate = new Date();
  var previousDate = new Date();
  previousDate.setHours(currentDate.getHours() - 24);

  queryTweetsTopicGrouping(previousDate.toJSON(), currentDate.toJSON(), res);
});


router.get("/testvisual", function(req, res, next) {
  testVisual(res);
});


/*
Search for certain tweets in the topic parameter
i.e. /twitterData/United_States
*/
router.get('/:topic', function(req, res, next) {
  var userTopic = req.params["topic"];
  userTopic = userTopic.replace(/\W+/g, " ");

  var jsonMode = req.query.output;

  queryDataSearchParam(userTopic, null, null, res, jsonMode);
  //res.send("Twitter data test query custom: " + userTopic);
});

/*
Handle no topic given in the URL params
i.e. /twitterData
*/
router.get('/', function(req, res, next) {
  queryDataSearchParam("Trump", null, null, res, "json");
  //res.send("Twitter data test query");
});

module.exports = router;
