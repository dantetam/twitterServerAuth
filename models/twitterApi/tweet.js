var mongoose = require('mongoose');
var mongooseRandom = require('mongoose-random');

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
  screenName: {
    type: String,
    required: true,
    trim: true
  },
  authorPrettyName: {
    type: String,
    required: true,
    trim: true
  },
  text: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  creationTime: {
    type: Date,
    required: true
  },
  mediaLinks: {
    type: [String],
    required: false
  },
  urlLinks: {
    type: [String],
    required: false
  }
});

TweetSchema.plugin(mongooseRandom, { path: 'r' }); // by default `path` is `random`. It's used internally to store a random value on each doc.


/*
TweetSchema.statics.test = function() {};
*/

var Tweet = mongoose.model('Tweet', TweetSchema);
module.exports = Tweet;
