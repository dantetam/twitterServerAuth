var express = require('express');
var async = require('async');
var router = express.Router();
var mongoose = require('mongoose');
var MongoClient = require('mongodb').MongoClient;

var twitterAnalysis = require('./twitterAnalysis.js');
var Tweet = require("../../models/twitterApi/tweet");
var UniqueTweet = require("../../models/twitterApi/uniqueTweet");
var TwitterUser = require("../../models/twitterApi/twitterUser");
var cluster = require('./unsupervisedCluster.js');
var metrics = require("./math/metrics.js");
var util = require('../util.js');

var SMALL_QUERY_LIMIT = 200;
var DEFAULT_QUERY_LIMIT = 500;
var LARGE_QUERY_LIMIT = 10000;

var TWITTER_SERVER_DATA_DIR_NAME = "twitterServer";

var databaseUrl = process.env.MONGODB_URI || "mongodb://localhost:27017/";

//TODO: Merge all the query tweets async/promises into a uniform method for querying tweets,
//and then custom callbacks to handle the results differently per use case.

function connectToTweetData(next) {
  //connect to MongoDB, initiate callback onConnection, using new mongoDB 3.0 client syntax
  MongoClient.connect(databaseUrl, function(err, client) {   //Return the mongoDB client obj
    //The client object encompasses the whole database
    if (err) throw err;
    next(null, client);
  });
}


function queryUserTweets(screenName, callback) {
  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, next) { //Find a not random subsampling of tweets to show
      var dbase = client.db(TWITTER_SERVER_DATA_DIR_NAME);
      TwitterUser.findOne({"screenName": screenName}, function(err, twitterUser) {
        if (twitterUser === null) { //The user was not found in the database
          next(err, null);
        }
        else {
          queryTweetsFromIdList(twitterUser["userTweetIds"], next);
        }
      });
    }
  ], function(err, result) {
    if (err) throw err;
    if (callback) {
      callback(null, result);
    }
  });
}


//Lookup tweets from the database using the local mongoDB ids ("_id"), not the Twitter internal ids.
function queryTweetsFromIdList(tweetDataIdList, next) {
  var mongooseObjectIds = tweetDataIdList.map(function(idString) {
    return mongoose.Types.ObjectId(idString);
  });
  Tweet.find({
    '_id': { $in: mongooseObjectIds}
  }, function(err, tweets) {
    next(err, tweets)
  });
}


function queryLargeCorpusTweets(callback) {
  var dataInclude = {authorPrettyName: 1, text: 1, creationTime: 1};

  var properNounTokens = null;

  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, next) { //Find a not random subsampling of tweets to show
      var dbase = client.db(TWITTER_SERVER_DATA_DIR_NAME);
      Tweet.aggregate(
        [
          {$match: {}},
          {$project: {_id: 1, text: 1}},
          //{"$limit": SMALL_QUERY_LIMIT}
          {$sample: {size: LARGE_QUERY_LIMIT}}
        ],
        function(err, sampleTweets) {
          if (err) throw err;
          var tweetStrings = sampleTweets.map(function(x) {return x["text"];});
          next(null, tweetStrings);
        }
      );
    }
  ], function(err, tweetStrings) {
    if (err) throw err;
    callback(err, tweetStrings);
  });
}


function findLargeSetProperNouns(callback) {
  async.waterfall([
    function(next) {
      queryLargeCorpusTweets(next);
    },
    function(tweetStrings, next) { //Find a not random subsampling of tweets to show
      var properNounTokens = twitterAnalysis.findProperNounsFromStrings(tweetStrings);
      var properNounSet = twitterAnalysis.findUnionDoubleArrTokens(properNounTokens);
      next(null, properNounSet);
    }
  ], function(err, results) {
    if (err) throw err;
    callback(err, results);
  });
}


function findUserSentimentOnTopics(screen_name, topicsList, callback) {
  async.waterfall([
    function(next) {
      queryUserTweets(screen_name, next);
    },
    function(tweetObjs, next) {
      var texts = tweetObjs.map(function(x) {return x["text"];});
      var doubleArrTokens = twitterAnalysis.sanitizeTweets(texts);
      var properNounTokens = twitterAnalysis.findProperNounsFromStrings(texts);
      findTweetSentimentOnTopics(doubleArrTokens, properNounTokens, topicsList, next);
    }
  ], function(err, sentimentObj) {
    callback(err, sentimentObj);
  });
}

function findTweetSentimentOnTopics(doubleArrTokens, properNounTokens, topicsList, next) {
  var topicsObj = {};
  var sentimentVecRes = [];
  //for (topic in topicsList) topicsObj[topic] = null;
  for (let arrTokens of doubleArrTokens) { //For every sentence
    //Get the averaged sentiment vector
    //and then check which tokens it has.
    //Update the sentiment for chosen topics i.e. "i love mustard" and topicsList = ["mustard"],
    //then update topicsObj["mustard"] = [2.8, 0.5];
    let sentimentVecCallback = function(err, avgSentimentVec) {
      sentimentVecRes.push(avgSentimentVec);
      if (sentimentVecRes.length === properNounTokens.length) {
        for (let sentenceIndex = 0; sentenceIndex < properNounTokens.length; sentenceIndex++) {
          for (let token of properNounTokens[sentenceIndex]) {
            if (topicsObj[token] === undefined) {
              topicsObj[token] = sentimentVecRes[sentenceIndex];
            }
            else if (Array.isArray(topicsObj[token])){
              topicsObj[token][0] += sentimentVecRes[sentenceIndex][0];
              topicsObj[token][1] += sentimentVecRes[sentenceIndex][1];
            }
          }
        }
        if (next) {
          next(null, topicsObj);
          return;
        }
      }
    };
    cluster.getAvgSentimentFromSentence(arrTokens, sentimentVecCallback);
  }
}

function queryUserTopicsVector(screenName, callback) {
  async.waterfall([
    function(next) {
      findLargeSetProperNouns(next);
    },
    function(topicsList, next) {
      findUserSentimentOnTopics(screenName, topicsList, next);
    }
  ], function(err, sentimentObj) {
    if (callback) {
      callback(err, sentimentObj);
    }
  })
}


function compareUsersTopicVectors(screenNameA, screenNameB, callback) {
  async.waterfall([
    function(next) {
      queryUserTopicsVector(screenNameA, next);
    },
    function(sentimentVecUserA, next) {
      queryUserTopicsVector(screenNameB, function(err, sentimentVecUserB) {
        next(null, sentimentVecUserA, sentimentVecUserB);
      });
    },
    function(sentimentVecUserA, sentimentVecUserB, next) {
      var similiarity = metrics.cosineSimilaritySentimentObj(sentimentVecUserA, sentimentVecUserB);
      next(null, sentimentVecUserA, sentimentVecUserB, similiarity);
    }
  ], function(err, sentimentVecUserA, sentimentVecUserB, similiarity) {
    if (callback) {
      callback(err, sentimentVecUserA, sentimentVecUserB, similiarity);
    }
  })
}


function queryTweetsSentiment(queryString, beginDate, endDate, callback) {
  var query = {};
  var dataInclude = {authorPrettyName: 1, text: 1, creationTime: 1};
  if (queryString && queryString.length > 0) query['text'] = new RegExp(queryString, 'i');
  if (beginDate && endDate) {
    query['creationTime'] = {
      $gte: new Date(beginDate),
      $lt: new Date(endDate)
    };
  }

  var collectedSampleTweets = null;
  var properNounTokens = null;

  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, next) { //Find a not random subsampling of tweets to show
      var dbase = client.db(TWITTER_SERVER_DATA_DIR_NAME);
      //console.log(query);
      Tweet.aggregate(
          [
              {$match: query},
              {$project: {_id: 1, text: 1}},
              //{"$limit": SMALL_QUERY_LIMIT}
              {$sample: {size: SMALL_QUERY_LIMIT}}
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
      properNounTokens = twitterAnalysis.findProperNounsFromStrings(sampleTweets); //Stored globally so it can be sent to next and webpage
      cluster.sentenceGroupGetSentiment(tweetArrTokens, next);
    }
  ], function(err, sentimentData) {
    if (err) throw err;
    //Add additional data to be sent to the client
    sentimentData["properNounTokens"] = properNounTokens;
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
  var dataInclude = {authorPrettyName: 1, text: 1, creationTime: 1};
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
      var dbase = client.db(TWITTER_SERVER_DATA_DIR_NAME);
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
  var dataInclude = {authorPrettyName: 1, text: 1, creationTime: 1};
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
      var dbase = client.db(TWITTER_SERVER_DATA_DIR_NAME);
      Tweet.aggregate(
          [
              {$match: query},
              {$project: {_id: 1, text: 1}},
              {$sample: {size: DEFAULT_QUERY_LIMIT}}
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
      cluster.testCluster(tweetArrTokens, next);
    }
  ], function(err, clusters) {
    var shannonIndex = metrics.modifiedShannonIndex(clusters);
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
  var dataInclude = {authorPrettyName: 1, text: 1, creationTime: 1};
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
      var dbase = client.db(TWITTER_SERVER_DATA_DIR_NAME);
      Tweet.aggregate(
          [
              {$match: query},
              {$project: {_id: 1, text: 1}},
              {$sample: {size: DEFAULT_QUERY_LIMIT}}
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
  var dataInclude = {authorPrettyName: 1, text: 1, creationTime: 1};
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
      var dbase = client.db(TWITTER_SERVER_DATA_DIR_NAME);
      Tweet.aggregate(
          [
              {$match: query},
              {$project: {_id: 1, text: 1}},
              {$sample: {size: DEFAULT_QUERY_LIMIT}}
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
  var dataInclude = {authorPrettyName: 1, text: 1, creationTime: 1};

  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, next) { //Find a not random subsampling of tweets to show
      var dbase = client.db(TWITTER_SERVER_DATA_DIR_NAME);
      dbase.collection("tweets").find(query, dataInclude).limit(DEFAULT_QUERY_LIMIT).toArray(function(err, sampleTweets) {
        if (err) throw err;
        next(null, client, sampleTweets);
      });
    },
    function(client, sampleTweets, next) {
      var dbase = client.db(TWITTER_SERVER_DATA_DIR_NAME);
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
  var dataInclude = {authorPrettyName: 1, text: 1, creationTime: 1};
  var query = {};
  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, next) { //Find a not random subsampling of tweets to show
      var dbase = client.db(TWITTER_SERVER_DATA_DIR_NAME);
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
    var tweetStrings = sampleTweets.map(function(tweet) {return tweet["text"];});
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


router.get('/userSentiment/:screenName', function(req, res, next) {
  var screenName = req.params["screenName"];
  queryUserTopicsVector(screenName, function(err, result) {res.send(result);});
});


router.get('/userSentiment/:screenNameA/:screenNameB', function(req, res, next) {
  var screenNameA = req.params["screenNameA"];
  var screenNameB = req.params["screenNameB"];
  compareUsersTopicVectors(screenNameA, screenNameB, function(err, sentimentVecUserA, sentimentVecUserB, similiarity) {
    res.write("Query for User Sentiment, between users '" + screenNameA + "' and '" + screenNameB + "':\n");
    res.write("Twitter User Sentiment Vector Similiarity: " + similiarity + "\n\n");
    res.write(JSON.stringify(sentimentVecUserA) + "\n\n");
    res.write(JSON.stringify(sentimentVecUserB) + "\n\n");
  });
});


router.get('/user/:screenName', function(req, res, next) {
  var screenName = req.params["screenName"];
  var outputMode = req.query["output"];
  queryUserTweets(screenName, function(err, tweets) {
    if (tweets === null) { //The queried user was not found
      res.render('twitterDataUserNotFound', {"screenName": screenName})
    }
    else {
      var tweetStrings = tweets.map(function(tweet) {return tweet["text"];});
      var topicFocuses = twitterAnalysis.findProperNounsFromStrings(tweetStrings);
      var wordCount = twitterAnalysis.getWordCountFromTweets(tweetStrings);

      //After done retrieving tweets and running calculations on them,
      //send them through the RESTful response.
      var resWriteCallback = function(err, sentimentData) {
        if (outputMode === "text") {
          res.write("Tweets queried from the user: " + screenName + "\n\n");
          res.write(util.JSON_stringify(topicFocuses) + "\n\n");

          for (var i = 0; i < tweetStrings.length; i++) {
            var newLineRemovedTweet = tweetStrings[i].replace(/\r?\n|\r/, "");
            var compiledString = newLineRemovedTweet + "\n";
            compiledString += " (Sentiment, Polarity: " + sentimentData.polarity[i] + ", Intensity: " + sentimentData.intensity[i] + ") \n";
            compiledString += " (Important Tokens: " + util.JSON_stringify(sentimentData.sentenceTokens[i]) + ") \n"
            res.write(compiledString);
          }

          res.write(util.JSON_stringify(wordCount) + "\n\n");
          res.write("Data collected from user (raw json): " + screenName + "\n\n")
          res.end(tweets + "\n\n");
        }
        else { //Use JSON mode by default
          var jsonObjResult = {};
          jsonObjResult["screen_name"] = screenName;
          jsonObjResult["topic_focus"] = topicFocuses;
          jsonObjResult["tweets"] = [];
          for (var i = 0; i < tweetStrings.length; i++) {
            var newLineRemovedTweet = tweetStrings[i].replace(/\r?\n|\r/, "");
            var compiledObj = {};  //Compile every tweet and its data into one object
            compiledObj["text"] = newLineRemovedTweet;
            compiledObj["sentiment_polarity"] = sentimentData.polarity[i];
            compiledObj["sentiment_intensity"] = sentimentData.intensity[i];
            compiledObj["important_tokens"] = sentimentData.sentenceTokens[i];
            jsonObjResult["tweets"].push(compiledObj);
          }
          res.send(jsonObjResult); //Send an array of analyzed tweets to the response
        }
      };

      cluster.sentenceGroupGetSentiment(twitterAnalysis.sanitizeTweets(tweetStrings), resWriteCallback);
    }
  });
});


router.get('/corpus', function(req, res, next) {
  queryLargeCorpusTweets(function(err, tweets) {res.send(tweets);});
});

router.get('/corpusTopics', function(req, res, next) {
  findLargeSetProperNouns(function(err, results) {res.send(results);});
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
