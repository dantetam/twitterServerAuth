var mongoose = require('mongoose');
var mongooseRandom = require('mongoose-random');

/**
A MongoDB schema used to represent tweet data
This is used to store all unique tweets (i.e. only one bare tweet, with no retweets).
This separate schema is used so that the larger tweet database with repeats
does not have to be queried for unique tweets.
*/

var UniqueTweetSchema = new mongoose.Schema({
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

UniqueTweetSchema.plugin(mongooseRandom, { path: 'r' }); // by default `path` is `random`. It's used internally to store a random value on each doc.


/*
UniqueTweetSchema.statics.test = function() {};
*/

var UniqueTweet = mongoose.model('UniqueTweet', UniqueTweetSchema);
module.exports = UniqueTweet;
