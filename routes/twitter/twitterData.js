var express = require('express');
var async = require('async');
var router = express.Router();

var MongoClient = require('mongodb').MongoClient;

var twitterAnalysis = require('./twitter_analysis.js');

var Tweet = require("../../models/tweet");

function connectToTweetData(next) {
  //connect to MongoDB, initiate callback onConnection, using new mongoDB 3.0 client syntax
  var url = "mongodb://localhost:27017/";
  MongoClient.connect(url, function(err, client) {   //Return the mongoDB client obj
    //The client object encompasses the whole database
    if (err) throw err;
    var dbase = db.db("testForAuth");
    next(null, client, dbase);
  });
}

function queryData() {
  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(client, dbase, next) {
      var regexQuery = {'text': /Trump/i};
      var dataInclude = {author: 1, text: 1, creationTime: 1};
      dbase.collection("tweets").find(regexQuery, dataInclude).toArray(function(err, result) {
        if (err) throw err;
        client.close();
        next(null, result);
      });
    }
  ], function(err, result) {
    if (err) {
      console.log(err);
    }
  });
}


/*
Handle no topic given in the URL params
i.e. /twitterData
*/
router.get('/', function(req, res, next) {
  queryData();
  res.send("Twitter data test query");
});

module.exports = router;
