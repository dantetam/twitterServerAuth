var self = module.exports = {
  //Compute the overlap similiarity score of two possibly unequal length vectors
  overlapScore: function(vecA, vecB) {
    if (vecA.length === 0 || vecB.length === 0) return 0;
    var overlap = {};
    var intersection = 0;
    for (var item of vecA) {
      if (overlap[item] === undefined) overlap[item] = 0;
    }
    for (var item of vecB) {
      if (overlap[item] === 0) intersection++;
    }
    var union = vecA.length + vecB.length - intersection;
    return intersection / union;
  },

  //The 'angle' similiarity of two vectors, where 1 represents parallel and 0 represents opposite facing vectors.
  cosineSimilarity: function(vecA, vecB) {
    if (vecA.length !== vecB.length) throw new Error("Cannot compute cos. similiarity of two unequal length vectors");
    var dotProduct = 0;
    var magA = 0, magB = 0;
    for (var i = 0; i < vecA.length; i++) {
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
      dotProduct = vecA[i] * vecB[i];
    }
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);
    if (magA * magB !== 0) return dotProduct / (magA * magB);
    return dotProduct;
  },

  euclideanDist: function(vecA, vecB) {
    if (vecA.length !== vecB.length) throw new Error("Cannot compute distance of two unequal length vectors");
    var result = 0;
    for (var i = 0; i < vecA.length; i++) {
      let diff = vecA[i] - vecB[i];
      result += diff * diff;
    }
    return Math.sqrt(result);
  },

  manhattanDist: function(vecA, vecB) {
    if (vecA.length !== vecB.length) throw new Error("Cannot compute distance of two unequal length vectors");
    var result = 0;
    for (var i = 0; i < vecA.length; i++) {
      result += Math.abs(vecA[i] - vecB[i]);
    }
    return result;
  },

  /**
  Sentence similiarity heuristic: for every word in sentence1, determine its best match, and average the best match for every word.
  */
  sentenceSimilarity: function(sentence1, sentence2) {
    if (sentence1.length === 0 || sentence2.length === 0) return 0;
    var avgMatch = 0;
    for (var wordVector of sentence1) {
      let bestMatch = null;
      for (var otherWordVector of sentence2) {
        var curMatch = self.euclideanDist(wordVector, otherWordVector) - self.cosineSimilarity(wordVector, otherWordVector);
        if (bestMatch === null || curMatch > bestMatch) {
          bestMatch = curMatch;
        }
      }
      avgMatch += bestMatch;
    }
    return avgMatch / sentence1.length;
  },

  /**
  This is a modified calculation of Shannon entropy, a general measure of "species" similiarity/homogeneity
  within a population. Its equation is S = exp( \sum_i p_i ln p_i ) where
  p_i is the proportion of objects belonging to the ith cluster.

  This has been modified to deal with clusters that may overlap. In that case, every unique object
  contributes a weight of 1 to both the total and the cluster proportions (weighted by occurrence).
  i.e. [1, 2] [1, 3, 4] -> p_1 = (0.5 + 1) / 4, p_2 = (0.5 + 1 + 1) / 4,
  then S = exp(0.375 ln 0.375 + 0.625 ln 0.625) ~ 0.516.
  */
  modifiedShannonIndex: function(clusters) {
    var counts = {};
    var uniqueItemsCount = 0;
    for (var cluster of clusters) {
      for (var item of cluster["points"]) {
        if (counts[item] === undefined) {
          counts[item] = 0;
          uniqueItemsCount++;
        }
        counts[item]++;
      }
    }
    var result = 0;
    for (var cluster of clusters) {
      var clusterWeight = 0;
      for (var item of cluster["points"]) {
        clusterWeight += 1 / counts[item];
      }
      result += clusterWeight * Math.log(clusterWeight);
    }
    return Math.exp(-result);
  },

  //The 'angle' similiarity of two sentiment vectors, with some overlapping and disjoint keys
  //A sentiment vector is organized in the form {"word": [polarity, intensity]}
  cosineSimilaritySentimentObj: function(objA, objB) {
    var dotProduct = 0;
    var magA = 0, magB = 0;
    for (var key in objA) {
      if (objB[key] !== undefined) {
        magA += objA[key][0] * objA[key][0];
        magB += objB[key][0] * objB[key][0];
        dotProduct = objA[key][0] * objB[key][0];
      }
    }
    if (magA * magB !== 0) return dotProduct / (magA * magB);
    return dotProduct;
  }

};
