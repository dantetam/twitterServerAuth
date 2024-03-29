/**
Methods for the Twitter endpoint/routing middleware that deal specifically with mongoDB interfacing and storage,
i.e. creating or retrieving tweets, and using the Tweet/TwitterUser schema.
*/

var async = require("async");

var textUtil = require("./textanalysis/textUtil.js");

var UniqueTweet = require("../../models/twitterApi/uniqueTweet");
var TwitterUser = require("../../models/twitterApi/twitterUser");

var self = module.exports = {

  /*
  Take the JSON data of the retrieved tweets and store them into the MongoDB database,
  using the Tweet schema defined in "/models/tweet.js".
  */
  storeTweetsInData: function(tweetsJson, next) {
    var results = [];
    var statuses = tweetsJson["statuses"];
    for (var i = 0; i < statuses.length; i++) {
      var status = statuses[i];
      //Using the data gathered from status, store it in the MongoDB schema compactly
      var tweetData = {
        idString: status["id_str"],
        screenName: status["user"]["screen_name"],
        authorPrettyName: status["user"]["name"],
        text: status["text"],
        creationTime: new Date(status["created_at"])
      }
      if (status["entities"]["media"] !== undefined) { //Optional hyperlinks
        tweetData.mediaLinks = status["entities"]["media"].map(function(mediaEntry) {return mediaEntry["media_url_https"];});
      }
      if (status["entities"]["urls"] !== undefined) {
        tweetData.urlLinks = status["entities"]["urls"].map(function(urlEntry) {return urlEntry["url"];});
      }
      //Unique tweets (i.e. without retweets) are stored again, and are unique,
      //such that user2: RT @user1: ..., user3: RT @user1: ...
      //are considered the same and stored only once.
      tweetData["text"] = textUtil.removeRetweet(status["text"]);
      UniqueTweet.create(tweetData, function(err, tweet) {});
    }
  },

  /*
  Take the JSON data of a single tweet and store it into the MongoDB database,
  using the UniqueTweet schema defined in "/models/uniqueTweet.js".
  Callback the database id, if newly created or already found.
  */
  storeSingleTweetInDataId: function(status, next) {
    var results = [];

    //Using the data gathered from status, store it in the MongoDB schema compactly
    var tweetData = {
      idString: status["id_str"],
      screenName: status["user"]["screen_name"],
      authorPrettyName: status["user"]["name"],
      text: status["text"],
      creationTime: new Date(status["created_at"])
    }
    if (status["entities"]["media"] !== undefined) { //Optional hyperlinks
      tweetData.mediaLinks = status["entities"]["media"].map(function(mediaEntry) {return mediaEntry["media_url_https"];});
    }
    if (status["entities"]["urls"] !== undefined) {
      tweetData.urlLinks = status["entities"]["urls"].map(function(urlEntry) {return urlEntry["url"];});
    }

    UniqueTweet.findOne({ 'idString': status["id_str"] }, function (err, result) {
      if (result === null) { //Callback with the already existing tweet in the database
        tweetData["text"] = textUtil.removeRetweet(status["text"]);
        UniqueTweet.create(tweetData, function(err, tweet) {
          if (err && next) { //Tweet creation not successful, but we should indicate that the tweet storing process has been finished
            //Do not propogate errors
            next(null, null);
          }
          else if (next) {
            next(null, tweet._id);
          }
        });
      }
      else {
        next(null, result._id);
      }
    });
  },

  /**
  Take a JSON user timeline object userTimelineJson and convert it into JSON stored in the TwitterUser schema.
  Look for the user if it exists, or create it. Send the new or existing TwitterUser database id ("_id") to the callback.
  */
  storeUserTimelineInData: function(userTimelineJson, callback) {
    if (userTimelineJson == null || userTimelineJson.length === 0) {
      callback(null, null);
      return;
    }
    var userObj = userTimelineJson[0]["user"];

    var tweetIdCreations = [];
    for (let tweet of userTimelineJson) {
      let tweetIdCreationFunc = function(next) {
        self.storeSingleTweetInDataId(tweet, next);
      };
      tweetIdCreations.push(tweetIdCreationFunc);
    }

    async.parallel(
      tweetIdCreations,
      function(err, tweetIds) {
        //Final callback after parallel execution (i.e. all tweet ids have been created or found)
        if (err) {
          throw err;
        }
        //Extract from the RESTful API response and add to the TwitterUser schema
        var profileLinks = [
          userObj["profile_background_image_url_https"],
          userObj["profile_image_url_https"],
          userObj["profile_banner_url"]
        ];
        var userData = {
          idString: userObj["id_str"],
          screenName: userObj["screen_name"],
          authorPrettyName: userObj["name"],
          profileLinks: profileLinks.filter(function(x) {return x !== undefined;}),
          userTweetIds: tweetIds
        }
        TwitterUser.findOne({ 'screenName': userObj["screen_name"] }, function (err, result) {
          if (result === null) {
            TwitterUser.create(userData, function(err, twitterUser) {
              if (callback) {
                callback(err, twitterUser);
              }
            });
          }
          else {
            if (callback) callback(null, result);
          }
        });

      }
    );
  }
}
