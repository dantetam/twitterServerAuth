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
1. Mikolov et al. Distributed Representations of Words and Phrases and their Compositionality. Google. Mountain View, CA, Oct 2013. &lt; https://arxiv.org/pdf/1310.4546.pdf &gt;

2. Hutto, C.J. & Gilbert, E.E. VADER: A Parsimonious Rule-based Model for Sentiment Analysis of Social Media Text. Eighth International Conference on Weblogs and Social Media (ICWSM-14). Ann Arbor, MI, June 2014. &lt; https://pdfs.semanticscholar.org/a6e4/a2532510369b8f55c68f049ff11a892fefeb.pdf &gt;

3. Pak A., Paroubek, P. Twitter as a Corpus for Sentiment Analysis and Opinion Mining. Université de Paris-Sud, Laboratoire LIMSI-CNRS, 2011. &lt; https://pdfs.semanticscholar.org/ad8a/7f620a57478ff70045f97abc7aec9687ccbd.pdf &gt;

4. Aggarwal, C. C., & Zhai, C. A Survey of Text Clustering Algorithms. IBM T. J. Watson Research Center. Yorktown Heights, USA, 2012. &lt; https://pdfs.semanticscholar.org/88c2/5e2481ba49cbac75575485cba1759fa4ebcc.pdf &gt;

5. Pagliardini, M., Gupta, P., Jaggi, M. Unsupervised Learning of Sentence Embeddings using Compositional n-Gram Features. Jul 2017. &lt; https://arxiv.org/abs/1703.02507 &gt;

Footnotes
-------
1. Obligatory for any paper and project that deals with latent semantic vectors ('featurizations') of words and language. word2vec is available for [download on Google's repositories](https://code.google.com/archive/p/word2vec/).

2. Used as a basic dictionary for quickly looking up the sentiment of certain words. I have used the vector data trained on tweets, appropriately. The VADER sentiment lexicon dictionary is licensed under the MIT license. See
[this GitHub repo](https://github.com/cjhutto/vaderSentiment) for a working Python lookup implementation.

3. The original basis of this whole project and the scholarly intention behind using Twitter as a source of NLP data.

4. The basis of my work in sentence clustering algorithms. As I've learned, measuring the semantic similarity of natural language is a complicated and not well-defined process. One of the main goals of this project is to develop more beautiful groupings and structure within tweets, by changing the definition of the similarity metric (such as using sentiment towards a topic, similarity of words and structure, and so on).

5. Included as an alternative algorithms of language featurizations. Pagliardini et. al. have released an unsupervised 'numerical representation' (featurization) library, through [mostly C++ software hosted on GitHub](https://github.com/epfml/sent2vec).
