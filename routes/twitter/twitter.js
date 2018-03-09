var express = require('express');
var async = require('async');
var router = express.Router();
var Repeat = require("repeat");
var request = require("request");

var authKeys = require('./twitter_auth.json');
var twitterAnalysis = require('./twitter_analysis.js');
var cluster = require('./unsupervisedCluster.js');

var Tweet = require("../../models/tweet");
var siteData = require("./storedTwitterConfig.js");

var focusTopicsCountMax = 25;

/*
Fix and modularize these callbacks so they form a neat queue and final callback to render the website
*/

/*
Read API keys from the hidden file, generate a bearer token from Twitter's OAuth endpoint,
and then start another callback.
*/
function findBearerToken(userTopic, next) {
  if (userTopic !== null && userTopic !== process.env.CURRENT_TOPIC) return; //Do not continue old repeating requests

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
    if (next) next(null, err, resp, body);
  });
}

/*
Use the previously found bearer token to OAuth into Twitter's tweet search API,
*/
function getTweets(bearerToken, userTopic, next) {
  var url = 'https://api.twitter.com/1.1/search/tweets.json';
  request({
    url: url + "?q=" + userTopic + "&count=50&lang=en&result_type=mixed",
    method: 'GET',
    headers: {
      "Authorization": "Bearer " + bearerToken,
      "Content-Type": "application/json"
    },
    json: true
  }, function(err, jsonResponse, body) {
    if (next) next(null, err, jsonResponse, body);
  });
}

/**
Convert the tweets JSON into a readable text format for display: username + tweet text.
*/
function parseTweets(tweetsJson) {
  var results = [];
  var statuses = tweetsJson["statuses"];
  for (var i = 0; i < statuses.length; i++) {
    var status = statuses[i];
    results.push(status["user"]["name"] + ": " + status["text"]);
  }
  return results;
}

/*
Use the application-only OAuth token to find popular Twitter topics
*/
function getTopics(bearerToken, next) {
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
    if (next) next(null, err, jsonResponse, body, bearerToken);
  });
}

/**
Convert Twitter Topic Search API JSON response into an array of topic strings.
*/
function parseTopics(topicsJson) {
  if (topicsJson["errors"]) return null;
  var trends = topicsJson[0]["trends"];
  var results = [];
  for (var trend of trends) {
    results.push(trend["query"]);
  }
  return results;
}

/**
Set up a correct 'async' queue of the following Twitter API actions:
find bearer token; get tweets relating to topic;
perform calculations on text data and send raw tweets to MongoDB database;
and a last callback at the end.
*/
function getTweetsWithChosenTopic(topic, word, next) {
  if (word === undefined) word = null;
  async.waterfall([
    function(next) {
      findBearerToken(topic, next); //Pass in no topic set to the website
      //i.e. find a bearer token without checking for a duplicate topic
    },
    function(err, resp, body, next) {
      var bearerToken = body["access_token"];
      getTweets(bearerToken, topic, next);
    },
    function(err, resp, body, next) {
      var tweetStrings = parseTweets(body);
      storeTweetsInData(body, next);
      getWordImportanceInTopic(tweetStrings, null);

      var wordCounts = twitterAnalysis.getWordCountFromTweets(tweetStrings, 2); //Get the word count of all words
      next(null, wordCounts);
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

function getTweetsWithTrendingTopic(word, next) {
  if (word === undefined) word = null;
  async.waterfall([
    function(next) {
      findBearerToken(null, next);
    },
    function(err, resp, body, next) {
      var bearerToken = body["access_token"];
      getTopics(bearerToken, next);
    },
    function(err, resp, body, bearerToken, next) {
      var topicStrings = parseTopics(body);
      var randomTopic = topicStrings[Math.floor(topicStrings.length * Math.random())];
      console.log("Chose trending topic (US): " + randomTopic);
      process.env.CURRENT_TOPIC = randomTopic;
      getTweets(bearerToken, randomTopic, next);
    },
    function(err, resp, body, next) {
      var tweetStrings = parseTweets(body);
      storeTweetsInData(body, next);
      getWordImportanceInTopic(tweetStrings, null);

      next(null, null);
    }
  ], function(err, result) {
    if (err) {
      console.log(err);
    }
    if (next) {
      next(result);
    }
  });
}

function getProperNounsFromTweets(next) {
  async.waterfall([
    function(next) {
      findBearerToken(null, next);
    },
    function(err, resp, body, next) {
      var bearerToken = body["access_token"];
      getTopics(bearerToken, next);
    },
    function(err, resp, body, bearerToken, next) {
      var topicStrings = parseTopics(body);
      var randomTopic = topicStrings[Math.floor(topicStrings.length * Math.random())];
      console.log("Chose trending topic for topic grouping (US): " + randomTopic);
      process.env.CURRENT_TOPIC = randomTopic;
      getTweets(bearerToken, randomTopic, next);
    },
    function(err, resp, body, next) {
      var tweetStrings = parseTweets(body);
      var properNounTokens = twitterAnalysis.findProperNounsFromStrings(tweetStrings);
      console.log(properNounTokens);
      var result = cluster.testProperNounTopicGrouping(properNounTokens);
      next(null, result);
    }
  ], function(err, result) {
    if (err) {
      console.log(err);
    }
    console.log(result)
    if (next) {
      next(result);
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
    specialWord = wordCounts[indexWord][0];
  }
  //Compute its tf-idf importance metric
  twitterAnalysis.tfidfIndividualAvgMeasure(groupedTweets, specialWord);
}

/*
Take the JSON data of the retrieved tweets and store them into the MongoDB database
*/
function storeTweetsInData(tweetsJson, next) {
  var results = [];
  var statuses = tweetsJson["statuses"];
  for (var i = 0; i < statuses.length; i++) {
    var status = statuses[i];

    var tweetData = {
      idString: status["id_str"],
      author: status["user"]["name"],
      text: status["text"],
      creationTime: new Date(status["created_at"])
    }

    Tweet.create(tweetData, function (error, tweet) {
      if (error) {
        return null;
      }
    });
  }
}


router.get("/topicclusters", function(req, res, next) {
  getProperNounsFromTweets(null);

  res.send("The server chose a topic to test topic associations.");
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
  res.send("Here is a collection of random tweets sampled from the database.");
  // Get random data using mongooseRandom query library
  Tweet.findRandom().limit(25).exec(function (err, tweets) {
    console.log(tweets);
    //res.send(tweets);
  });
});
*/


router.get('/wordmap/:topic', function(req, res, next) {
  var userTopic = req.params["topic"];
  process.env.CURRENT_TOPIC = userTopic;
  //The callback to first update the page when the user uses this endpoint
  var firstCallback = function(err, result) {
    //This sends the word counts to the client, which are rendered by d3.js in the browser.
    res.render('tweetWordCount', {wordCounts: JSON.stringify(result)});
  };
  getTweetsWithChosenTopic(userTopic, null, firstCallback);
});


/* This callback happens when the user creates the requests
GET /twittertest/:topic
where :topic is a kind of "wildcard"
i.e. it catches /twittertest/California
 */
router.get('/:topic', function(req, res, next) {
  var userTopic = req.params["topic"] || process.env.CURRENT_TOPIC;
  if (userTopic === process.env.CURRENT_TOPIC) {
    res.send("The server is active and still processing the same Twitter topic request: " + userTopic);
  };
  process.env.CURRENT_TOPIC = userTopic;

  //Only start a new queue of repeating requests when the topic changes
  Repeat(function() {
    getTweetsWithChosenTopic(process.env.CURRENT_TOPIC, null, null);
  }).every(1000 * 30 * 1, 'ms').start.now();

  res.send("The server is now processing the Twitter topic: " + userTopic);
});


/*
Handle no topic given in the URL params
*/
router.get('/', function(req, res, next) {
  /*
  res.render('twitter', { //Only render the website when we are finished writing to it
    title: 'Twitter Feed',
    topic: 'N/A',
    tweets: ['No tweets yet. Input a topic such as /twitter/California']
  });
  */
  Repeat(function() {
    getTweetsWithTrendingTopic(null, null);
  }).every(1000 * 60 * 1, 'ms').start.now();

  res.send("The server is processing a chosen topic.");
});

module.exports = router;
