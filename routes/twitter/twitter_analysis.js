var stemmer = require('./stemmer.js');
var natural = require('natural');

var self = module.exports = {

  //Sourced from https://stackoverflow.com/questions/4180363/javascript-regexp-replacing-1-with-f1
  camelCaseSeparate: function(stringValue) {
    return stringValue.replace(/([A-Z]+)/g, " $1").replace(/([A-Z][a-z])/g, " $1");
  },

  /**
  Return a dictionary where dict[word] === true if word is a stop word.
  */
  getStopWords: function() {
    var data = [ "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have",
    "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've",
    "if", "in", "into", "is", "it", "it's", "its", "itself", "let's", "me", "more", "most", "my", "myself", "nor", "of", "on", "once", "only", "or",
    "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "she'd", "she'll", "she's", "should", "so", "some", "such", "than", "that", "that's",
    "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through",
    "to", "too", "under", "until", "up", "very", "was", "we", "we'd", "we'll", "we're", "we've", "were", "what", "what's", "when", "when's", "where", "where's",
    "which", "while", "who", "who's", "whom", "why", "why's", "with", "would", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves" ];
    var result = {};
    for (var word of data) {
      result[word] = true;
    }
    return result;
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

    var stopWordsDict = self.getStopWords();

    //Once hashtags are processed, remove all non-alphanumeric characters, change to lowercase, and split by whitespace
    var tokens = tweetSplitHashtags.toLowerCase().replace(/[^a-zA-Z ]/g, "").split(/[ ,]+/);
    //Go backwards since we are removing elements, arraylist trap
    for (var i = tokens.length - 1; i >= 0; i--) {
      var token = tokens[i];
      if (token.indexOf("...") !== -1 || token.indexOf("https://") !== -1 || token.length == 0 || stopWordsDict[token]) {
        tokens.splice(i, 1);
      }
    }
    return tokens;
  },

  removeStopWords: function(doubleArrTokens) {
    var stopWordsDict = self.getStopWords();
    for (var arrTokens of doubleArrTokens) {
      for (var i = arrTokens.length; i >= 0; i--) { //Go backwards since we remove elements i.e. 'arraylist trap'
        if (stopWordsDict[arrTokens[i]]) { //If the individual token is in the dict of stop words
          arrTokens.splice(i, 1);
        }
      }
    }
    return doubleArrTokens;
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

  /**
  Take in a collection of documents and a word to look for,
  and return the word's importance using the tf-idf metric per document.
  */
  tfidfIndividualMeasure: function(texts, word) {
    var tfidf = new natural.TfIdf();

    for (var text of texts) {
      tfidf.addDocument(text);
    }

    console.log("Measuring importance of word: " + word);
    tfidf.tfidfs(word, function(i, measure) {
      console.log('document #' + i + ' is ' + measure);
    });
  },


  /*
  Takes in an array of an array of tokens, and returns a sorted list of 'dictionary' entries indexed by [word, count]
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
    var listSortedResults = [];
    for (var word in results) {
      if (results.hasOwnProperty(word)) {
        if (results[word] < cutoffCountInc) {
          delete results[word];
        }
        else {
          listSortedResults.push([word, results[word]]);
        }
      }
    }
    listSortedResults.sort(function(a, b) {
      return b[1] - a[1]; //Sort by word count in descending order
    });
    return listSortedResults;
  },

  /*
  The public facing method for taking in an array of tweet strings, direcrly from the JSON callback,
  and returning a list of words by count.
  */
  getWordCountFromTweets: function(tweetsArr) {
    var doubleArrTokens = self.sanitizeTweets(tweetsArr);
    var tweetsWordCount = self.wordCount(doubleArrTokens);
    return tweetsWordCount;
  }

};
