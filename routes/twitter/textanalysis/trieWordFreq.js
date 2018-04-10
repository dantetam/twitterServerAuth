var readline = require('readline');
var fs = require('fs');

var textUtil = require("./textUtil.js");
var stemmer = require("./stemmer.js");

/**
A custom trie data structure in JS object format for storing word frequencies. See
./trieDictionary.js
for the same data structure, as well as documentation.

The DP spacing and MLE estimation algorithm (using the assumption of Zipf's law on
frequencies of words) is sourced from
https://stackoverflow.com/questions/8870261/how-to-split-text-without-spaces-into-list-of-words#answer-11642687
*/

//The file listed here must be in txt format, with a single word on each line,
//and ordered from the top descending in frequency.
var WORD_FREQ_FILE = "./routes/twitter/google-10000-english-usa.txt";

var LOG_TOTAL_NUM_WORDS = Math.log(10000);

/**
  * Assume that tweets won't be using unnecessarily large words
  * Produce a few errors while greatly speeding up computation;
  *this lessens the number of candidates to search (from i, search i - MAX_WORD : i).
*/
var MAX_WORD = 12; //18;

var INACTIVE = -1; //This is a static enum representing the existence of a path but not an actual word
//For example, findWord("dar") = INACTIVE, but findWord("dark") = 0.02, and findWord("darkz") = undefined.

var self = {

  addWord: function(word, rank) {
    if (word.length > MAX_WORD) return;

    var pointer = self._data;
    for (var i = 0; i < word.length; i++) {
      var char = word.charAt(i);
      if (pointer[char] === undefined) {
        pointer[char] = {};
      }
      pointer = pointer[char];
    }
    var zipfProb = Math.log( (i+1) * LOG_TOTAL_NUM_WORDS );
    pointer["rank"] = zipfProb;
  },

  getWordProb: function(word, alsoCheckStemmed = true) {
    if (textUtil.isNumber(word)) {
      //Assigning a constant probability to every number favors longer continuous numbers,
      //i.e. P(1000) > P(1,0,0,0);
      var numberLenProb = Math.log( 1000 * LOG_TOTAL_NUM_WORDS );
      return numberLenProb;
    }
    var word = word.toLowerCase();
    var pointer = self._data;
    for (var i = 0; i < word.length; i++) {
      var char = word.charAt(i);
      if (pointer[char] === undefined) {
        return undefined;
      }
      pointer = pointer[char];
    }
    if (pointer["rank"] === undefined) { //Check the base word first.
      //If not available and we want to check the stemmed word, do so.
      if (alsoCheckStemmed) return self.getWordProb(stemmer.stemWord(word), false);
      else return INACTIVE;
    }
    return pointer["rank"];
  },

  /**
  Async read a dictionary text file containing a word on every line.
  This is formatted as "word1 \n word2 \n ..." without spaces.
  */
  readWordsFile: function(fileName) {
    if (self._data !== undefined) return;
    self._data = {};

    var lineReader = readline.createInterface({
      input: fs.createReadStream(fileName)
    });

    var lineCounter = 1;
    lineReader.on('line', function (line) {
      self.addWord(line.trim(), lineCounter);
      lineCounter++;
    });

    /*
    //Test for trieWordFreq when done reading word frequencies file
    lineReader.on('close', function () {
      var shortTestString = "HandsOffOurCoast";
      var longTestString = "itwasadarkandstormynighttherainfellintorrentsexceptatoccasionalintervalswhenitwascheckedbyaviolentgustofwindwhichsweptupthestreetsforitisinlondonthatoursceneliesrattlingalongthehousetopsandfiercelyagitatingthescantyflameofthelampsthatstruggledagainstthedarkness";
      var spacedWords = self.inferSpaces(shortTestString);
      console.log(spacedWords);
    });
    */
  },

  /**
  Sourced from
  https://stackoverflow.com/questions/8870261/how-to-split-text-without-spaces-into-list-of-words#answer-11642687
  originally in Python. As per the user's answer,

  "The best way to proceed is to model the distribution of the output...
  It is reasonable to assume that [word frequencies] follow Zipf's law,
  that is the word with rank n...has probability roughly 1/(n log N),
  where N is the number of words in the dictionary.

  Once you have fixed the model, you can use dynamic programming to infer the position of the spaces.
  The most likely sentence is the one that maximizes the product of the probability of each individual word,
  ...[and use log space costs] to avoid overflows."

  @param s Unspaced string to parse, with possible capital letters and special characters.
  @return An array of tokens, the resulting separated words
  */
  inferSpaces: function(s) {
    //Uses dynamic programming to infer the location of spaces in a string without spaces.

    /*
    Find the best match for the i first characters, assuming cost has
    been built for the i-1 first characters.
    Return the best pair (match_cost, match_length).
    */
    var best_match = function(i) {
      var start = Math.max(0, i-MAX_WORD);
      var end = i;
      var bestMatch = [9999, start];
      //console.log("-----------------------" + start + " " + end);
      for (var k = start; k < end; k++) {
        //console.log(s.substring(i-k-1, i) + " " + s.substring(k, i) + " " + cost[i-k-1] + " " + self.getWordProb(s.substring(i-k-1, i)))
        //console.log(s.substring(k, i) + " " + cost[k] + " " + self.getWordProb(s.substring(k, i)));
        if (self.getWordProb(s.substring(k, i)) === undefined) {
          continue;
        }
        if (cost[k] === undefined || self.getWordProb(s.substring(k, i)) === INACTIVE) {
          //TODO: efficiently stop computation if a word prefix is _entirely_ not found within the trie structure
          //Note that multiple distinctions need to be made:
          //nonexistent nodes ("darkz"), inactive nodes ("dar"), and active nodes ("dark").
          continue;
        }
        if (cost[k] + self.getWordProb(s.substring(k, i)) < bestMatch[0] || bestMatch[1] === -1) {
          bestMatch[0] = cost[k] + self.getWordProb(s.substring(k, i));
          bestMatch[1] = k+1;
        }
      }
      return bestMatch;
    }

    //Build the DP cost array
    var cost = [0];
    for (var i = 1; i <= s.length; i++) {
      var match = best_match(i);
      cost.push(match[0]);
    }

    //Backtrack to recover the minimal-cost string
    var out = [];
    var i = s.length;
    while (i>0) {
      var match = best_match(i);
      var c = match[0]; var k = match[1];
      var chosenWord = s.substring(k-1, i);
      out.unshift(chosenWord);
      i = k-1;
    }
    return out;
  },

  inferSpacesString: function(s) {
    var arrTokens = self.inferSpaces(s);
    return arrTokens.join(" ");
  }

};

self.readWordsFile(WORD_FREQ_FILE);

module.exports = self;
