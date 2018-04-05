/**
Natural language processing methods with algorithms to parse higher level sentences and text,
and extract word tokens, content words, and proper nouns from raw tweets, and more.
*/

var textUtil = require("./textanalysis/textUtil.js");
var stemmer = require('./textanalysis/stemmer.js');
var natural = require('natural');
var util = require("../util.js");

var trieDictionary = require("./textanalysis/trieDictionary.js");

var self = module.exports = {

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
    "which", "while", "who", "who's", "whom", "why", "why's", "with", "would", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
    "rt",
    "youre", "doesnt", "dont", "didnt", "aint", "couldnt", "shouldnt", "gonna", "wanna", "isnt", "arent", "wasnt", "werent", "hes", "shes", "mr", "mrs"]; //Also add common misspellings
    var result = {};
    for (var word of data) {
      result[word] = true;
      if (word.indexOf("'") !== -1) {
        wordChars = word.replace(/[^a-z0-9]/g, "");
        result[wordChars] = true;
      }
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
      return textUtil.camelCaseSeparate(group2);
    });

    var stopWordsDict = self.getStopWords();

    //Once hashtags are processed, remove all non-alphanumeric characters, change to lowercase, and split by whitespace
    var tokens = tweetSplitHashtags.toLowerCase().split(/[ ,]+/);
    //Go backwards since we are removing elements, arraylist trap
    for (var i = tokens.length - 1; i >= 0; i--) {
      var token = tokens[i].trim();
      if (token.indexOf("…") !== -1 || token.indexOf("https") !== -1 || token.indexOf("@") !== -1 || token.indexOf("rt") !== -1 || stopWordsDict[token]) {
        tokens.splice(i, 1);
        continue;
      }
      tokens[i] = tokens[i].replace(/[^a-z0-9]/g, " ");
      //tokens[i] = tokens[i].replace(/[ ]/g, "");
      tokens[i] = tokens[i].replace(/\r?\n|\r/g, " ");
      if (tokens[i].length === 0 || stopWordsDict[tokens[i]]) { //Transform the token to letters and again check to see if it is not a stop word
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

  wordAllowed: function(word) {
    return word.toLowerCase().replace(/[^a-z]/g, "").length > 2;
  },

  /*
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
  */

  notNamedEntity: function(word) {
    var lower = word.toLowerCase();
    //Twitter users often use letter 'stretches' like 'soooo' to convey emotion, which bypass the dictionary
    //This corresponds to the third option
    return trieDictionary.findWord(lower) ||
      lower.indexOf("https") !== -1 ||
      (!trieDictionary.findWord(lower) && textUtil.majorityLetter(lower)) ||
      textUtil.isNumber(lower);
  },

  findAllProperNouns: function(doubleArrTokens) {
    for (let arrTokens of doubleArrTokens) {
      for (let i = arrTokens.length - 1; i >= 0; i--) { //Go backwards since we remove elements i.e. 'arraylist trap'
        if (self.notNamedEntity(arrTokens[i]) || arrTokens[i].length <= 2) { //If the individual token is in the dict of stop words
          arrTokens.splice(i, 1);
        }
      }
    }
    return doubleArrTokens;
  },

  /**
  Content words are simply all words
  that are neither proper nouns,
  nor stop words.
  */
  findAllContentWords: function(doubleArrTokens) {
    var stopWordsDict = self.getStopWords();
    for (var arrTokens of doubleArrTokens) {
      for (var i = arrTokens.length - 1; i >= 0; i--) { //Go backwards since we remove elements i.e. 'arraylist trap'
        if (!self.notNamedEntity(arrTokens[i]) || stopWordsDict[token]) { //If the individual token is in the dict of stop words
          arrTokens.splice(i, 1);
        }
      }
    }
    return doubleArrTokens;
  },

  /**
  Take in a collection of documents and a word to look for,
  and return the word's importance using the tf-idf metric per document.
  */
  tfidfIndividualAvgMeasure: function(texts, word) {
    if (!texts || texts.length === 0) return 0;

    var tfidf = new natural.TfIdf();

    for (var text of texts) {
      tfidf.addDocument(text);
    }

    //console.log("Measuring importance of word: " + word);
    var result = 0;
    tfidf.tfidfs(word, function(i, measure) {
      //console.log('document #' + i + ' is ' + measure);
      result += measure;
    });
    return result / texts.length;
  },

  /**
  Search for all instances of words after _inspectWord_, which represents the distribution
  P(next word | this word is _inspectWord_)
  */
  bigramCounter: function(doubleArrTokens, inspectWord) {
    var insWordLower = inspectWord.trim().toLowerCase();
    var counts = {};
    for (var arrTokens of doubleArrTokens) {
      for (var i = 0; i < arrTokens.length - 1; i++) {
        var nextWord = arrTokens[i+1];
        if (arrTokens[i] === insWordLower) {
          if (counts[nextWord] === undefined) {
            counts[nextWord] = 0;
          }
          counts[nextWord]++;
        }
      }
    }
    return self.sortDictIntoList(counts, 3);
  },


  /*
  Takes in an array of an array of tokens, and returns a sorted list of 'dictionary' entries indexed by [word, count]
  */
  wordCount: function(doubleArrTokens, cutoffCount = 5) {
    var results = {};
    for (var i = 0; i < doubleArrTokens.length; i++) {
      var listTokens = doubleArrTokens[i];
      for (var j = 0; j < listTokens.length; j++) {
        var token = listTokens[j];
        //token = stemmer.stemWord(token);
        if (!self.wordAllowed(token)) {
          continue;
        }
        if (!(results.hasOwnProperty(token))) {
          results[token] = 0;
        }
        results[token]++;
      }
    }
    var listSortedResults = util.sortDictIntoList(results, cutoffCount);
    return listSortedResults;
  },


  /**
  The public facing method for taking in an array of tweet strings, direcrly from the JSON callback,
  and returning a list of words by count.
  */
  getWordCountFromTweets: function(tweetsArr, cutoffCountInc = 5) {
    var doubleArrTokens = self.sanitizeTweets(tweetsArr);
    var tweetsWordCount = self.wordCount(doubleArrTokens, cutoffCountInc);
    return tweetsWordCount;
  },

  /**
  The public facing method for finding proper nouns from an array of text (condensing the token retrieval and rejection part)
  */
  findProperNounsFromStrings: function(tweetsArr) {
    return self.findAllProperNouns(self.sanitizeTweets(tweetsArr));
  },

  findUnionDoubleArrTokens: function(doubleArrTokens) {
    var recordedTokens = {};
    for (var arrTokens of doubleArrTokens) {
      for (var token of arrTokens) {
        if (recordedTokens[token] === undefined) {
          recordedTokens[token] = true;
        }
      }
    }
    return Object.keys(recordedTokens);
  },

  /**
  A utility method: given an array of tweets either indexed as
  ["text1", "text2", ...] or
  [{"text": ...}, {"text": ...}, ...],
  and given an array of clusters, represented as [[tweetId1, tweetId2, ...], [tweetId1, tweetId3, ...]],
  return a formatting of the clusters, for human reading.
  */
  stringifyClustersTweets: function(tweetsTextArr, clusters) {
    var result = [];
    for (var i = 0; i < clusters.length; i++) {
      var clusterString = "Cluster " + i + ": ";
      for (var j = 0; j < clusters[i].points.length; j++) {
        var index = clusters[i].points[j];
        if (tweetsTextArr[index]["text"] !== undefined) {
          clusterString += tweetsTextArr[index]["text"] + "\\n";
        }
        else {
          clusterString += tweetsTextArr[index] + "\\n";
        }
      }
      result.push(clusterString);
    }
    return result;
  }

};
