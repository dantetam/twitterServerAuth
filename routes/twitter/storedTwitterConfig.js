//Convenient file for storing global variables and configuration data into one accessible file and object.
//Simply siteData = require("path/to/storedTwitterConfig.js"); siteData[VARIABLE_NAME]...

var siteData = {
  FOCUS_TOPICS: [], //Current topics to prioritize, added to beginning
  FOCUS_TOPICS_COUNT_MAX: 25,

  RECENT_TWITTER_TOPICS: [], //Current twitter topics processed, 0th index is most recent
  TOPIC_SEARCH_API_CACHE: [], //The most recently processed topics, starting with the most recent in front (0 index)
  TOPIC_FRAME_NUM: 0, //A counter to keep track of how many updates a topic list has been used for
  TOPIC_FRAME_GET_NEW: 12, //The frame at which to discard cached Twitter API results and retrieve new ones
  NUM_USERS_PER_FRAME: 5, //Number of users to query every user endpoint frame

  NUM_TEST_CLUSTERS_BUILT: 50,

  SMALL_QUERY_LIMIT: 200,
  DEFAULT_QUERY_LIMIT: 1000,
  LARGE_QUERY_LIMIT: 10000,
  TWITTER_SERVER_DATA_DIR_NAME: "twitterServer", //The directory within the database to check
  DATABASE_URL: process.env.MONGODB_URI || "mongodb://localhost:27017/" //The local of the mongoDB database url
};

module.exports = siteData;
