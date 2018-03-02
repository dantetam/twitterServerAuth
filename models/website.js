var mongoose = require('mongoose');
var mongooseRandom = require('mongoose-random');

var page = require(''); //Include the mongoDB schema for individual pages as well

/**
A MongoDB schema used to represent tweet data
*/

var WebsiteSchema = new mongoose.Schema({
  webPage: {
    type: [Schema.Types.WebPage],
    required: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  updateTime: {
    type: Date,
    required: true
  },
  creationTime: {
    type: Date,
    required: true
  }
});

/*
WebsiteSchema.statics.test = function() {};
*/

var Website = mongoose.model('Website', WebsiteSchema);
module.exports = Website;
