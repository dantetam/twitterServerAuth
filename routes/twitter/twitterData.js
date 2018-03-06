var express = require('express');
var async = require('async');
var router = express.Router();
var MongoClient = require('mongodb').MongoClient;

var twitterAnalysis = require('./twitter_analysis.js');
var Tweet = require("../../models/tweet");
var cluster = require('./unsupervisedCluster.js');

var DEFAULT_QUERY_LIMIT = 300;

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
      dbase.collection("tweets").find(query, dataInclude).limit(DEFAULT_QUERY_LIMIT).toArray(function(err, sampleTweets) {
        if (err) throw err;
        collectedSampleTweets = sampleTweets;
        next(null, sampleTweets);
      });
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
      cluster.testCluster(tweetArrTokens, next);
    }
  ], function(err, clusters) {
    console.log(clusters);
    var result = [];
    for (var i = 0; i < clusters.length; i++) {
      var clusterString = "Cluster " + i + ": ";
      for (var j = 0; j < clusters[i].points.length; j++) {
        var index = clusters[i].points[j];
        clusterString += collectedSampleTweets[index]["text"] + "\\n";
      }
      result.push(clusterString);
    }
    response.send(result);
  });
}


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
      dbase.collection("tweets").find(query, dataInclude).limit(DEFAULT_QUERY_LIMIT).toArray(function(err, sampleTweets) {
        if (err) throw err;
        collectedSampleTweets = sampleTweets;
        next(null, sampleTweets);
      });
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
      for (var j = 0; j < mst[i].length; j++) {
        var firstIndex = mst[i][0];
        var secondIndex = mst[i][1];
        edgeString += collectedSampleTweets[firstIndex]["text"] + " && " + collectedSampleTweets[secondIndex]["text"];
      }
      result.push(edgeString);
    }

    //result.push("MST contains cycle: " + cluster.graphContainsCycle(mst));
    response.send(result);
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

//Test querying the database by time; get most recent tweets
//i.e. /twitterData/recent
router.get('/recent', function(req, res, next) {
  var currentDate = new Date();
  var previousDate = new Date();
  previousDate.setHours(currentDate.getHours() - 8);
  console.log(previousDate);
  console.log(currentDate);

  var jsonMode = req.query.output;

  queryDataSearchParam("", previousDate.toJSON(), currentDate.toJSON(), res, jsonMode);
  //res.send("Twitter data test query custom: " + userTopic);
});


router.get('/recentmst', function(req, res, next) {
  var currentDate = new Date();
  var previousDate = new Date();
  previousDate.setHours(currentDate.getHours() - 8);
  console.log(previousDate);
  console.log(currentDate);

  queryTweetsMst("", previousDate.toJSON(), currentDate.toJSON(), res);
  //res.send("Twitter data test query custom: " + userTopic);
});


router.get('/recentcluster', function(req, res, next) {
  var currentDate = new Date();
  var previousDate = new Date();
  previousDate.setHours(currentDate.getHours() - 8);
  console.log(previousDate);
  console.log(currentDate);

  queryTweetsCluster("", previousDate.toJSON(), currentDate.toJSON(), res);
  //res.send("Twitter data test query custom: " + userTopic);
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
