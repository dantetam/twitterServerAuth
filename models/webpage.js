var mongoose = require('mongoose');
var mongooseRandom = require('mongoose-random');

/**
A MongoDB schema used to represent tweet data
*/

var WebPageSchema = new mongoose.Schema({
  text: {
    type: String
  },
  metadata: {
    type: Object
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  recordUpdateTime: {
    type: Date,
    required: true
  }
});

/*
WebsiteSchema.statics.test = function() {};
*/

var Website = mongoose.model('WebPage', WebPageSchema);
module.exports = Website;
