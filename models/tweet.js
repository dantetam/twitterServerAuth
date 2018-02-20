var mongoose = require('mongoose');
var bcrypt = require('bcrypt');

/**
A MongoDB schema used to represent tweet data
*/

var TweetSchema = new mongoose.Schema({
  idString: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  creationTime: {
    type: Date,
    required: true
  }
});

/*
TweetSchema.statics.test = function() {};
*/

var Tweet = mongoose.model('Tweet', TweetSchema);
module.exports = Tweet;
