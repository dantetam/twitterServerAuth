var siteData = {
  "focusTopics": [],  //Current topics to prioritize, added to beginning
  RECENT_TWITTER_TOPICS: [],  //Current twitter topics processed, 0th index is most recent
  TOPIC_SEARCH_API_CACHE: [],
  TOPIC_FRAME_NUM: 0, //A counter to keep track of how many updates a topic list has been used for
  TOPIC_FRAME_GET_NEW: 12 //The frame at which to discard cached Twitter API results and retrieve new ones
};

module.exports = siteData;
