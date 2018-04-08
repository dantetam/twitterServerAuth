//Convenient file for storing global variables and configuration data into one accessible file and object.
//Simply siteData = require("path/to/storedTwitterConfig.js"); siteData[VARIABLE_NAME]...

var siteData = {
  "focusTopics": [],  //Current topics to prioritize, added to beginning
  RECENT_TWITTER_TOPICS: [],  //Current twitter topics processed, 0th index is most recent
  TOPIC_SEARCH_API_CACHE: [],
  TOPIC_FRAME_NUM: 0, //A counter to keep track of how many updates a topic list has been used for
  TOPIC_FRAME_GET_NEW: 12, //The frame at which to discard cached Twitter API results and retrieve new ones

  SMALL_QUERY_LIMIT: 200,
  DEFAULT_QUERY_LIMIT: 1000,
  LARGE_QUERY_LIMIT: 10000,
  TWITTER_SERVER_DATA_DIR_NAME: "twitterServer",
  databaseUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/"
};

module.exports = siteData;
