var readline = require('readline');
var fs = require('fs');

/**
A custom trie data structure in JS object format for storing word frequencies. See
./trieDictionary.js
for the same data structure, as well as documentation.

The DP spacing and MLE estimation algorithm (using the assumption of Zipf's law on
frequencies of words) is sourced from
https://stackoverflow.com/questions/8870261/how-to-split-text-without-spaces-into-list-of-words#answer-11642687
*/

var LOG_TOTAL_NUM_WORDS = Math.log(10000);
//var MAX_WORD = 18;
var MAX_WORD = 12;

var self = {

  //_data: {
    //Data here is structured in the form of nodes, {active: true/false, children: {}}
    //The first children are all letters
  //},

  addWord: function(word, rank) {
    //self._maxWord = Math.max(word.length, self._maxWord);
    //console.log(self._maxWord);

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

  getWordProb: function(word) {
    var pointer = self._data;
    for (var i = 0; i < word.length; i++) {
      var char = word.charAt(i);
      if (pointer[char] === undefined) {
        return undefined;
      }
      pointer = pointer[char];
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

    lineReader.on('close', function () {
      var shortTestString = "nightnightknight";
      var longTestString = "itwasadarkandstormynighttherainfellintorrentsexceptatoccasionalintervalswhenitwascheckedbyaviolentgustofwindwhichsweptupthestreetsforitisinlondonthatoursceneliesrattlingalongthehousetopsandfiercelyagitatingthescantyflameofthelampsthatstruggledagainstthedarkness";
      var spacedWords = self.inferSpaces(shortTestString);
      console.log(spacedWords);
    });
  },

  inferSpaces: function(s) {
    //Uses dynamic programming to infer the location of spaces in a string without spaces.

    /*
    Find the best match for the i first characters, assuming cost has
    been built for the i-1 first characters.
    Return the best pair (match_cost, match_length).
    */
    var best_match = function(i) {
      var bestMatch = [9999, -1];
      var start = Math.max(0, i-MAX_WORD);
      var end = i;
      for (var k = start; k < end; k++) {
        //console.log(s.substring(i-k-1, i) + " " + cost[i-k-1] + " " + self.getWordProb(s.substring(i-k-1, i)))
        if (cost[i-k-1] === undefined || self.getWordProb(s.substring(i-k-1, i)) === undefined) continue;
        if (cost[i-k-1] + self.getWordProb(s.substring(i-k-1, i)) < bestMatch[0] || bestMatch[1] === -1) {
          bestMatch[0] = cost[i-k-1] + self.getWordProb(s.substring(i-k-1, i));
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
      var chosenWord = s.substring(i-k, i);
      out.unshift(chosenWord);
      i -= k;
    }

    return out;
    //return " ".join(reversed(out))
  }

};

console.log("In trieWordFreq.js");

self.readWordsFile("./routes/twitter/google-10000-english-usa.txt");

module.exports = self;
