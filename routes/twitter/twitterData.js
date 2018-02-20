var express = require('express');
var async = require('async');
var router = express.Router();

var mongoose = require('mongoose');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var MongoClient = require('mongodb').MongoClient;

var authKeys = require('./twitter_auth.json');
var twitterAnalysis = require('./twitter_analysis.js');

var Tweet = require("../../models/tweet");

function connectToTweetData(next) {
  //connect to MongoDB, initiate callback onConnection, using new mongoDB 3.0 client syntax
  var url = "mongodb://localhost:27017/";
  MongoClient.connect(url, function(err, db) {   //here db is the client obj
    if (err) throw err;
    var dbase = db.db("testForAuth");
    next(null, dbase);
  });
}

function queryData() {
  async.waterfall([
    function(next) {
      connectToTweetData(next);
    },
    function(db, next) {
      var searchResults = db.getCollection("tweets").find({'text':/Trump/i});
      console.log(searchResults);
      next(null);
    }
  ], function(err) {
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
