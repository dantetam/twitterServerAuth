var mongoose = require('mongoose');
var mongooseRandom = require('mongoose-random');

/**
A MongoDB schema used to represent tweet data
*/

var TwitterUserSchema = new mongoose.Schema({
  idString: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  screenName: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  authorPrettyName: {
    type: String,
    required: true,
    trim: true
  },
  profileLinks: {
    type: [String],
    required: false
  },
  userTweetIds: {
    type: [mongoose.Schema.Types.ObjectId],
    required: true
  }
});

TwitterUserSchema.plugin(mongooseRandom, { path: 'r' }); // by default `path` is `random`. It's used internally to store a random value on each doc.


/*
TweetSchema.statics.test = function() {};
*/

var TwitterUser = mongoose.model('TwitterUser', TwitterUserSchema);
module.exports = TwitterUser;
