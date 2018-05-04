Twitter NLP Server
============
This is a node.js RESTful API served by express.js middleware, pug/jade templates, and a MongoDB/Mongoose schema and database.

The index of this server lists all of the endpoints used for analysis, visualization, and calculation.

This server creates a RESTful API by using the Twitter Search/Topic APIs to find tweet content, and delivers results using server-side NLP computations. Tweets, results, and other data are stored within the Mongoose database, and can be efficiently queried by the server. Moreover, this server uses async IO/callbacks to deliver results quickly.


Research & Innovation
-----------------

The Twitter database is a large stream of human information with valuable natural language processing applications. In this project, I explored computer language featurizations (using word2vec, sentiment vectors, and other interpretations of language) and clustering algorithms (mainly hierarchical clustering, established and my own creative approach), to develop and analyze political and sociological trends within the larger Twitter community. 

I sought to provide these insights in real time through a node.js full stack website, that could be easily deployed across multiple machines. Also, I wanted to provide real-world applicable results and queries: the link between a user's history of tweets and the same user's sentiment towards a topic; a particular group's focus of words given a certain topic; and so on.


Starting a Server
-----------------

Note that you need to register with Twitter's Developer API for your own API keys. This project only handles standard (free) search across recent tweets.

```
/* Create a MongoDB instance at 'mongodb://localhost/twitterServer' */

/* Start the Node.js server */
npm start

/* Visit localhost:3000/ in dev environment, or use production host and port. */
```

I recommend mLab for having an online MongoDB instance, with its own special URL.  
Note that tweets are relatively compact, and the average tweet consumes ~370-400B of data.
A set of a million tweets consumes 340 MB, with a MongoDB index around 150 MB large.

Citations and Attributions
-------
1. Hutto, C.J. & Gilbert, E.E. (2014). VADER: A Parsimonious Rule-based Model for Sentiment Analysis of Social Media Text. Eighth International Conference on Weblogs and Social Media (ICWSM-14). Ann Arbor, MI, June 2014.

2. Mikolov et al. (2013). Distributed Representations of Words and Phrases and their Compositionality. Google. Mountain View, CA, Oct 2013.

3. Pak, Paroubek. Twitter as a Corpus for Sentiment Analysis and Opinion Mining. Universit ́e de Paris-Sud, Laboratoire LIMSI-CNRS. 2011. &lt; http://web.archive.org/web/20111119181304/http://deepthoughtinc.com/wp-content/uploads/2011/01/Twitter-as-a-Corpus-for-Sentiment-Analysis-and-Opinion-Mining.pdf &gt;

4. Aggarwal, C. C., & Zhai, C. (2012). A Survey of Text Clustering Algorithms. IBM T. J. Watson Research Center. Yorktown Heights, USA, 2012. &lt; https://pdfs.semanticscholar.org/88c2/5e2481ba49cbac75575485cba1759fa4ebcc.pdf &gt;

5. Pagliardini, M., Gupta, P., Jaggi, M. (2017). Unsupervised Learning of Sentence Embeddings using Compositional n-Gram Features. Jul 2017. &lt; https://arxiv.org/abs/1703.02507 &gt;

Footnotes
-------
1. The VADER sentiment lexicon dictionary is licensed under the MIT license. See
[this GitHub repo](https://github.com/cjhutto/vaderSentiment) for a working Python lookup implementation.

2. word2vec is available for [download on Google's repositories](https://code.google.com/archive/p/word2vec/).
