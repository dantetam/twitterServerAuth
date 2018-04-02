var mongoose = require('mongoose');
//var bcrypt = require('bcrypt');

var TimeUseSchema = new mongoose.Schema({
  emailCreator: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  desc: {
    type: String,
    trim: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  color: {
    type: String,
    trim: true
  }
});

var TimeUse = mongoose.model('TimeUse', TimeUseSchema);
module.exports = TimeUse;
