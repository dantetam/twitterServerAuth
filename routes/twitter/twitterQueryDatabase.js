/**
Organize all methods, some async, which query the mongoDB database/mongoClient/database schema for information.
This is usually done through client..., Schema.findOne/Schema.aggregate/Schema.find..., and so on.
*/

var async = require('async');
var mongoose = require('mongoose');
var MongoClient = require('mongodb').MongoClient;

var Tweet = require("../../models/twitterApi/tweet");
var UniqueTweet = require("../../models/twitterApi/uniqueTweet");
var TwitterUser = require("../../models/twitterApi/twitterUser");

var siteData = require("./storedTwitterConfig.js");

var self = module.exports = {

  connectToTweetData: function(next) {
    //connect to MongoDB, initiate callback onConnection, using new mongoDB 3.0 client syntax
    MongoClient.connect(siteData.databaseUrl, function(err, client) {   //Return the mongoDB client obj
      //The client object encompasses the whole database
      if (err) throw err;
      next(null, client);
    });
  },

  //Async lookup all tweets in the database that belong to a certain user.
  queryUserTweets: function(screenName, callback) {
    async.waterfall([
      function(next) {
        self.connectToTweetData(next);
      },
      function(client, next) { //Find a not random subsampling of tweets to show
        var dbase = client.db(siteData.TWITTER_SERVER_DATA_DIR_NAME);
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
  },

  aggregateBasic: function(query, sampleLength, next) {
    var query = {};
    UniqueTweet.aggregate(
      [
        {$match: query},
        {$project: {_id: 1, text: 1}},
        {$sample: {size: sampleLength}}
      ],
      function(err, sampleTweets) {
        if (err) throw err;
        if (next) next(null, sampleTweets);
      }
    );
  },

  /**
  An async query to retrieve tweets that contain any terms within _searchTerms_, through a special mongoDB regex query.
  The tweet objects (with fields in _dataInclude_) are sent to the callback.
  */
  aggregateMultipleOrTerms: function(searchTerms, sampleLength, next) {
    var regexArray = [];
    for (var searchTerm of searchTerms) {
      regexArray.push(new RegExp(searchTerm, "i"));
    }
    var query = {};
    if (regexArray.length > 0) query = {"text": {$in : regexArray}};
    var dataInclude = {authorPrettyName: 1, text: 1, creationTime: 1};
    UniqueTweet.aggregate(
      [
        {$match: query},
        {$project: {_id: 1, text: 1}},
        {$sample: {size: sampleLength}}
      ],
      function(err, sampleTweets) {
        if (err) throw err;
        if (next) next(null, sampleTweets);
      }
    );
  },

  queryDatabaseTweetsAndStats: function(query, callback) {
    var dataInclude = {authorPrettyName: 1, text: 1, creationTime: 1};
    async.waterfall([
      function(next) {
        self.connectToTweetData(next);
      },
      function(client, next) { //Find a not random subsampling of tweets to show
        var dbase = client.db(siteData.TWITTER_SERVER_DATA_DIR_NAME);
        dbase.collection("tweets").find(query, dataInclude).limit(siteData.DEFAULT_QUERY_LIMIT).toArray(function(err, sampleTweets) {
          if (err) throw err;
          next(null, client, sampleTweets);
        });
      },
      function(client, sampleTweets, next) {
        var dbase = client.db(siteData.TWITTER_SERVER_DATA_DIR_NAME);
        dbase.collection("tweets").find(query, dataInclude).toArray(function(err, result) {
          if (err) throw err;
          client.close();
          var queryCount = result.length;
          next(null, sampleTweets, queryCount);
        });
      },
      function(sampleTweets, queryCount, next) {
        UniqueTweet.count({}, function (err, totalCount) {
          next(err, sampleTweets, queryCount, totalCount);
        });
      }
    ], function(err, sampleTweets, queryCount, totalCount) {
      if (err) console.log(error);
      if (callback) callback(err, sampleTweets, queryCount, totalCount);
    });
  }

};
