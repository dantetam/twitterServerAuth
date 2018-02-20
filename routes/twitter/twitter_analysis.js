var stemmer = require('./stemmer.js');

var self = module.exports = {

  //Sourced from https://stackoverflow.com/questions/4180363/javascript-regexp-replacing-1-with-f1
  camelCaseSeparate: function(stringValue) {
    return stringValue.replace(/([A-Z]+)/g, " $1").replace(/([A-Z][a-z])/g, " $1");
  },

  /*
  Takes in a string tweet, which may contain bad characters/misformed words,
  and returns a lower case version, in an array of tokens.
  */
  sanitizeTweet: function(tweet) {
    //Capture all hashtag regex patterns, which returns two groups for each full match:
    //the hashtag symbol, which is discarded; and the hashtag topic, which is divided into words since it is usually camelCase
    var tweetSplitHashtags = tweet.replace(/(\#)([a-zA-Z]+)/g, function(match, group1, group2, index, original) {
      return self.camelCaseSeparate(group2);
    });

    //Once hashtags are processed, remove all non-alphanumeric characters, change to lowercase, and split by whitespace
    var tokens = tweetSplitHashtags.toLowerCase().replace(/[^a-zA-Z ]/g, "").split(/[ ,]+/);
    //Go backwards since we are removing elements, arraylist trap
    for (var i = tokens.length - 1; i >= 0; i--) {
      var token = tokens[i];
      if (token.indexOf("...") !== -1 || token.indexOf("https://") !== -1 || token.length == 0) {
        tokens.splice(i, 1);
      }
    }
    return tokens;
  },

  /*
  Takes in an array of tweets, and returns an array of an array of tokens
  */
  sanitizeTweets: function(tweetsArr) {
    var results = [];
    for (var i = 0; i < tweetsArr.length; i++) {
      results.push(self.sanitizeTweet(tweetsArr[i]));
    }
    return results;
  },

  /*
  Takes in an array of an array of tokens, and returns a word count dictionary
  */
  wordCount: function(doubleArrTokens, cutoffCountInc = 5) {
    var results = {};
    for (var i = 0; i < doubleArrTokens.length; i++) {
      var listTokens = doubleArrTokens[i];
      for (var j = 0; j < listTokens.length; j++) {
        var token = listTokens[j];
        //token = stemmer.stemWord(token);
        if (!(results.hasOwnProperty(token))) {
          results[token] = 0;
        }
        results[token]++;
      }
    }
    for (var word in results) {
      if (results.hasOwnProperty(word)) {
        if (results[word] < cutoffCountInc) {
          delete results[word]
        }
      }
    }
    return results;
  },

  /*
  The public facing method for taking in an array of tweet strings, direcrly from the JSON callback,
  and returning a list of words by count.
  */
  getWordCountFromTweets: function(tweetsArr) {
    doubleArrTokens = self.sanitizeTweets(tweetsArr);
    tweetsWordCount = self.wordCount(doubleArrTokens);
    console.log(tweetsWordCount);
  }

};
