var self = {

  /**
  Split text by all types of punctuation and newline characters.
  Sourced from:
  https://stackoverflow.com/questions/11761563/javascript-regexp-for-splitting-text-into-sentences-and-keeping-the-delimiter#answer-11761720

  This matches all instances of any group of non-punctuation characters, ended by punctuation (i.e. a sentence).
  This also separates by newline, and accounts for the last sentence which may not end in punctuation.
  */
  splitTextIntoSentences: function() {
    //var resultArr = str.match( /[^\.!\?\n]+[\.!\?\n]+/g );
    var resultArr = str.match( /[^\.!\?\n]+[\.!\?\n]+|([^\.!\?\n]+$)/g );
    return resultArr;
  }

}

module.exports = self;
