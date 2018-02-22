var express = require('express');
var async = require('async');
var router = express.Router();
var MongoClient = require('mongodb').MongoClient;

var twitterAnalysis = require('./twitter_analysis.js');
var Tweet = require("../../models/tweet");

var DEFAULT_QUERY_LIMIT = 100;

function connectToTweetData(next) {
  //connect to MongoDB, initiate callback onConnection, using new mongoDB 3.0 client syntax
  var url = "mongodb://localhost:27017/";
  MongoClient.connect(url, function(err, client) {   //Return the mongoDB client obj
    //The client object encompasses the whole database
    if (err) throw err;
    var dbase = client.db("testForAuth");
    next(null, client, dbase);
  });
}


function queryDataSearchParam(queryString, beginDate, endDate, response) {
  var query = {};
  if (queryString && queryString.length > 0) query['text'] = new RegExp(queryString);
  if (beginDate && endDate) {
    query['creationTime'] = {
      $gte: new Date(beginDate),
      $lt: new Date(endDate)
    };
  }
  queryData(query, response);
}


function queryData(query, response) {
  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, dbase, next) {
      var dataInclude = {author: 1, text: 1, creationTime: 1};

      dbase.collection("tweets").find(query, dataInclude).limit(DEFAULT_QUERY_LIMIT).toArray(function(err, result) {
        if (err) throw err;
        client.close();
        next(null, result);
      });
    }
  ], function(err, result) {
    if (err) {
      console.log(err);
    }
    response.send(result);
  });
}

//Test querying the database by time; get most recent tweets
router.get('/recent', function(req, res, next) {
  var currentDate = new Date();
  var previousDate = new Date();
  previousDate.setHours(currentDate.getHours() - 24);
  console.log(previousDate);
  console.log(currentDate);
  queryDataSearchParam("", previousDate.toJSON(), currentDate.toJSON(), res);
  //res.send("Twitter data test query custom: " + userTopic);
});

/*
Search for certain tweets in the topic parameter
i.e. /twitterData/United_States
*/
router.get('/:topic', function(req, res, next) {
  var userTopic = req.params["topic"];
  queryDataSearchParam(userTopic, null, null, res);
  //res.send("Twitter data test query custom: " + userTopic);
});

/*
Handle no topic given in the URL params
i.e. /twitterData
*/
router.get('/', function(req, res, next) {
  queryDataSearchParam("Trump", null, null, res);
  //res.send("Twitter data test query");
});

module.exports = router;
