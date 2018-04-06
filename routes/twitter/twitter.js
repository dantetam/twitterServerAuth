var express = require('express');
var async = require('async');
var router = express.Router();
var Repeat = require("repeat");
var request = require("request");

var authKeys = require('./twitterAuth.json');
var twitterAnalysis = require('./twitterAnalysis.js');
var twitterStoreUtil = require('./twitterStoreDatabase.js');
var cluster = require('./unsupervisedCluster.js');

var Tweet = require("../../models/twitterApi/tweet");
var UniqueTweet = require("../../models/twitterApi/uniqueTweet");
var TwitterUser = require("../../models/twitterApi/twitterUser");
var siteData = require("./storedTwitterConfig.js");

var focusTopicsCountMax = 25;

//This method is passed in the socket io communication objects
//(initialized and retrieved upon connection within the main server).
router.initConnectToSocket = function(socket, io) {
  console.log("Connection created between main server and twitter endpoint client");
  router.sendTweetsSocketMsg = function(tweets) {
    socket.emit('/twitter/', {
      "tweets": tweets
    });
  };
  router.sendTweetsAndUserSocketMsg = function(tweets, userString) {
    socket.emit('/twitter/', {
      "tweets": tweets,
      "userString": userString
    });
  };
}


function serverChooseTopic(topicStr) {
  var prevTopic = siteData.CURRENT_TOPIC;
  siteData.CURRENT_TOPIC = topicStr;
  if (!siteData.MOST_RECENT_TWITTER_TOPICS) {
    siteData.MOST_RECENT_TWITTER_TOPICS = [];
  }
  siteData.MOST_RECENT_TWITTER_TOPICS.splice(0, 0, topicStr);
  //If the array exceeds maximum length, remove last element
  if (siteData.MOST_RECENT_TWITTER_TOPICS.length > process.env.RECENT_TWITTER_TOPICS_LIMIT_NUM) {
    siteData.MOST_RECENT_TWITTER_TOPICS.splice(process.env.RECENT_TWITTER_TOPICS_LIMIT_NUM, 1);
  }
  console.log(siteData.MOST_RECENT_TWITTER_TOPICS);
  return prevTopic === topicStr;
}


/*
Fix and modularize these callbacks so they form a neat queue and final callback to render the website
*/

/*
Read API keys from the hidden file, generate a bearer token from Twitter's OAuth endpoint,
and then start another callback.
*/
function findBearerToken(userTopic, next) {
  //if (userTopic !== null && userTopic !== process.env.CURRENT_TOPIC) return; //Do not continue old repeating requests

  var key = authKeys.consumer_key;
  var secret = authKeys.consumer_secret;
  var cat = key + ":" + secret;
  var credentials = new Buffer(cat).toString('base64');

  var url = 'https://api.twitter.com/oauth2/token';

  request({
    url: url,
    method: 'POST',
    headers: {
      "Authorization": "Basic " + credentials,
      "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"
    },
    json: true,
    body: "grant_type=client_credentials"
  }, function(err, resp, body) {
    if (err) throw err;
    process.env.CURRENT_BEARER_TOKEN = body["access_token"];
    if (next) next(err, resp, body);
  });
}

/*
Use the previously found bearer token to OAuth into Twitter's tweet user timeline collection API.
*/
function getUserTimeline(bearerToken, screenName, next) {
  var url = 'https://api.twitter.com/1.1/statuses/user_timeline.json';
  request({
    url: url + "?screen_name=" + screenName + "&count=200",
    method: 'GET',
    headers: {
      "Authorization": "Bearer " + bearerToken,
      "Content-Type": "application/json"
    },
    json: true
  }, function(err, jsonResponse, body) {
    if (jsonResponse["errors"]) {
      console.log(jsonResponse["errors"]);
    }
    if (next) next(null, err, jsonResponse, body);
  });
}

/*
Use the previously found bearer token to OAuth into Twitter's tweet search API,
*/
function getTweets(bearerToken, userTopic, next) {
  var url = 'https://api.twitter.com/1.1/search/tweets.json';
  request({
    url: url + "?q=" + userTopic + "&count=100&lang=en&result_type=mixed",
    method: 'GET',
    headers: {
      "Authorization": "Bearer " + bearerToken,
      "Content-Type": "application/json"
    },
    json: true
  }, function(err, jsonResponse, body) {
    if (next) next(err, jsonResponse, body);
  });
}

/**
Convert the tweets JSON into a readable text format for display: username + tweet text.
*/
function parseTweets(tweetsJson) {
  var results = [];
  var statuses = tweetsJson["statuses"];
  var results = statuses.map(function(status) {return status["user"]["name"] + ": " + status["text"];});
  return results;
}

/*
Use the application-only OAuth token to find popular Twitter topics
*/
function getTopics(bearerToken, next) {
  if (siteData.TOPIC_SEARCH_API_CACHE && siteData.TOPIC_SEARCH_API_CACHE.length > 0) {
    if (next) next(null, siteData.TOPIC_SEARCH_API_CACHE, bearerToken);
    siteData.TOPIC_FRAME_NUM++;
    if (siteData.TOPIC_FRAME_NUM === siteData.TOPIC_FRAME_GET_NEW) {
      siteData.TOPIC_FRAME_NUM = 0;
      siteData.TOPIC_SEARCH_API_CACHE = null;
    }
    console.log(siteData.TOPIC_FRAME_NUM);
  }
  else {
    var url = 'https://api.twitter.com/1.1/trends/place.json?id=23424977';
    request({
      url: url,
      method: 'GET',
      headers: {
        "Authorization": "Bearer " + bearerToken,
        "Content-Type": "application/json"
      },
      json: true
    }, function(err, jsonResponse, body) {
      siteData.TOPIC_SEARCH_API_CACHE = body;
      if (next) next(err, body, bearerToken);
    });
  }
}

/**
Convert Twitter Topic Search API JSON response into an array of topic strings.
*/
function parseTopics(topicsJson) {
  if (topicsJson["errors"]) {
    console.log(topicsJson["errors"]);
    return null;
  }
  var trends = topicsJson[0]["trends"];
  var results = trends.map(function(trendJson) {return trendJson["query"];});
  return results;
}


function getUserTimelineTweets(screenName, callback) {
  async.waterfall([
    function(next) {
      findBearerToken(null, next);
    },
    function(resp, body, next) {
      var bearerToken = body["access_token"];
      getUserTimeline(bearerToken, screenName, next);
    },
    function(err, resp, body, next) {
      twitterStoreUtil.storeUserTimelineInData(body, next);
    }
  ], function(err, result) {
    if (callback) {
      callback(err, result);
    }
  });
}


/**
Set up a correct 'async' queue of the following Twitter API actions:
find bearer token; get tweets relating to topic;
perform calculations on text data and send raw tweets to MongoDB database;
and a last callback at the end.
*/
function getTweetsWithChosenTopic(topic, word, callback) {
  if (word === undefined) word = null;
  async.waterfall([
    function(next) {
      findBearerToken(topic, next); //Pass in no topic set to the website
      //i.e. find a bearer token without checking for a duplicate topic
    },
    function(resp, body, next) {
      var bearerToken = body["access_token"];
      getTweets(bearerToken, topic, next);
    },
    function(resp, body, next) {
      var tweetStrings = parseTweets(body);
      twitterStoreUtil.storeTweetsInData(body);
      getWordImportanceInTopic(tweetStrings, null);

      var wordCounts = twitterAnalysis.getWordCountFromTweets(tweetStrings, 2); //Get the word count of all words
      next(null, wordCounts);
    }
  ], function(err, result) {
    if (err) {
      console.log(err);
    }
    if (callback) {
      callback(null, result);
    }
  });
}

function getTweetsWithTrendingTopic(word, next) {
  if (word === undefined) word = null;
  async.waterfall([
    function(next) {
      findBearerToken(null, next);
    },
    function(resp, body, next) {
      var bearerToken = body["access_token"];
      getTopics(bearerToken, next);
    },
    function(body, bearerToken, next) {
      var topicStrings = parseTopics(body);
      //No topics found. Just exit with an error.
      if (topicStrings === null || topicStrings === undefined || topicStrings.length === 0) {
        next(new Error("No topics found from parseTopics(...)."), null);
      }
      else {
        var randomTopic = topicStrings[Math.floor(topicStrings.length * Math.random())];
        //console.log("Chose trending topic (US): " + randomTopic);
        //process.env.CURRENT_TOPIC = randomTopic;
        serverChooseTopic(randomTopic);
        getTweets(bearerToken, randomTopic, next);
      }
    },
    function(resp, body, next) {
      var tweetStrings = parseTweets(body);
      twitterStoreUtil.storeTweetsInData(body);
      getWordImportanceInTopic(tweetStrings, null);

      next(null, body);
    }
  ], function(err, result) {
    if (err) {
      console.log(err);
    }
    if (next) {
      next(null, result);
    }
  });
}

function getProperNounsFromTweets(next) {
  async.waterfall([
    function(next) {
      findBearerToken(null, next);
    },
    function(resp, body, next) {
      var bearerToken = body["access_token"];
      getTopics(bearerToken, next);
    },
    function(body, bearerToken, next) {
      var topicStrings = parseTopics(body);
      var randomTopic = topicStrings[Math.floor(topicStrings.length * Math.random())];
      //console.log("Chose trending topic for topic grouping (US): " + randomTopic);
      //process.env.CURRENT_TOPIC = randomTopic;
      serverChooseTopic(randomTopic);
      getTweets(bearerToken, randomTopic, next);
    },
    function(resp, body, next) {
      var tweetStrings = parseTweets(body);
      var properNounTokens = twitterAnalysis.findProperNounsFromStrings(tweetStrings);
      //console.log(properNounTokens);
      var clusters = cluster.testProperNounTopicGrouping(properNounTokens);
      next(null, tweetStrings, clusters);
    }
  ], function(err, tweetStrings, clusters) {
    if (err) {
      console.log(err);
    }
    if (next) {
      next(null, tweetStrings, clusters);
    }
  });
}


/**
Find a word's tf-idf importance in a collection of tweets, which are the individual "documents".
*/
function getWordImportanceInTopic(tweetStrings, specialWord) {
  //Combine individual tweets into multiple sentence documents for analysis
  var groupedTweets = [];
  var groupSize = 10;
  for (var i = 0; i <= tweetStrings.length; i += groupSize) {
    var group = "";
    for (var j = i; j < Math.min(i + groupSize, tweetStrings.length); j++) {
      group += tweetStrings[j] + ". ";
    }
    groupedTweets.push(group);
  }

  if (specialWord === null) {
    //Get word counts for finding a suitable test word
    var wordCounts = twitterAnalysis.getWordCountFromTweets(tweetStrings);

    //Find the 7th most popular word
    var indexWord = Math.min(7, wordCounts.length - 1);
    if (indexWord <= 0) {
      return;
    }
    specialWord = wordCounts[indexWord][0];
  }
  //Compute its tf-idf importance metric
  twitterAnalysis.tfidfIndividualAvgMeasure(groupedTweets, specialWord);
}


router.get("/topicgroups", function(req, res, next) {
  var outputMode = req.query["output"];
  getProperNounsFromTweets(function(err, tweetsTextArr, clusters) {
    var result = twitterAnalysis.stringifyClustersTweets(tweetsTextArr, clusters);
    if (outputMode === "text") {
      res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
      res.write("The server chose a topic to test topic associations.");
      res.end(JSON.stringify(result));
    }
    else {
      res.send(result);
    }
  });
});


/**
For the requests PUT /twitter/focus/:topic and DELETE ...,
the user inputs a string topic that the server stores in a compiled list of topics.
*/
router.put("/focus/:topic", function(req, res, next) {
  var userTopic = req.params["topic"];
  //res.send("request: PUT /focus/" + userTopic);
  siteData["focusTopics"].splice(0, 0, userTopic);
  if (siteData["focusTopics"].length > focusTopicsCountMax) {
    siteData["focusTopics"].splice(siteData["focusTopics"].length - 1, 1);
  }
  res.send(siteData["focusTopics"]);
});


router.delete("/focus/:topic", function(req, res, next) {
  var userTopic = req.params["topic"];
  for (var i = 0; i < siteData["focusTopics"].length; i++) {
    if (siteData["focusTopics"][i] === userTopic) {
      siteData["focusTopics"].splice(i, 1);
    }
  }
  res.send(siteData["focusTopics"]);
});


/*
router.get("/randomSample", function(req, res, next) {

});
*/


router.get('/wordmap/:topic', function(req, res, next) {
  var userTopic = req.params["topic"];
  //process.env.CURRENT_TOPIC = userTopic;
  serverChooseTopic(userTopic);
  //The callback to first update the page when the user uses this endpoint
  var firstCallback = function(err, result) {
    //This sends the word counts to the client, which are rendered by d3.js in the browser.
    res.render('tweetWordCount', {wordCounts: JSON.stringify(result)});
  };
  getTweetsWithChosenTopic(userTopic, null, firstCallback);
});


router.get('/user/:screenName', function(req, res, next) {
  var screenName = req.params["screenName"];
  getUserTimelineTweets(screenName, function(err, result) {
    if (err && err.name === 'MongoError' && err.code === 11000) { //The user entry already exists within the data
      res.send("User with screen name '" + screenName + "' is already recorded in the database.")
    }
    else {
      res.send(result);
    }
  });
});


router.get('/tweetAndUserLookup', function(req, res, next) {
  var tweetsCallback = function(err, retrievedTweets, userDisplayString) { //Callback to call every update to render to the client
    if (router.sendTweetsAndUserSocketMsg !== undefined) {
      router.sendTweetsAndUserSocketMsg(retrievedTweets, userDisplayString);
    }
  }

  Repeat(function() {
    getTweetsWithTrendingTopic(null, function(err, retrievedTweets) {
      if (retrievedTweets === null || retrievedTweets["statuses"] === null) return;
      //Get a random user from one tweet and look that user up
      var randomIndex = Math.floor(Math.random() * retrievedTweets["statuses"].length);
      var randomUserScreenName = retrievedTweets["statuses"][randomIndex]["user"]["screen_name"];

      getUserTimelineTweets(randomUserScreenName, function(err, twitterUser) {
        var userDisplayString = "Storing timeline from user: "
          + twitterUser["screenName"] + " (" + twitterUser["authorPrettyName"] + ")\n";
        tweetsCallback(err, retrievedTweets, userDisplayString);
      });
    });
  }).every(process.env.SERVER_MS_DELAY, 'ms').start.now();

  //res.send("The server is processing both a stream of tweets and storing a random author from the sample.");

  res.render('twitterEndpoint', {port: process.env.PORT || 3000});
});


/* This callback happens when the user creates the requests
GET /twittertest/:topic
where :topic is a kind of "wildcard"
i.e. it catches /twittertest/California
 */
router.get('/:topic', function(req, res, next) {
  var userTopic = req.params["topic"] || process.env.CURRENT_TOPIC;
  //process.env.CURRENT_TOPIC = userTopic;
  var choseDifferentTopic = serverChooseTopic(userTopic);
  if (choseDifferentTopic) {
    res.send("The server is active and still processing the same Twitter topic request: " + userTopic);
  }

  //Only start a new queue of repeating requests when the topic changes
  Repeat(function() {
    getTweetsWithChosenTopic(process.env.CURRENT_TOPIC, null, null);
  }).every(process.env.SERVER_MS_DELAY, 'ms').start.now();

  res.send("The server is now processing the Twitter topic: " + userTopic);
});


/*
Handle no topic given in the URL params
*/
router.get('/', function(req, res, next) {
  var tweetsCallback = function(err, result) {
    if (router.sendTweetsSocketMsg !== undefined) {
      router.sendTweetsSocketMsg(result);
    }
  }

  //Set up an infinite server loop to retrieve tweets,
  //and once done, send those tweets to the client.
  Repeat(function() {
    getTweetsWithTrendingTopic(null, tweetsCallback);
  }).every(process.env.SERVER_MS_DELAY, 'ms').start.now();

  //res.send("The server is processing a chosen topic.");
  res.render('twitterEndpoint', {port: process.env.PORT || 3000});
});

module.exports = router;
