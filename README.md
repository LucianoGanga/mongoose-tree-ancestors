# mongoose-tree-ancestors - Introduction

Do you ever wanted to integrate a Tree Structure with documents refering to a parent, and the parent of the parent, avoiding a recursive function? Probably not, but if you ever think about that, you will be loosing time. 

Instead of that, you can apply a data structure called ** Mongoose Tree Structure with an Array of Ancestors ** . What's that? 

Take a look in the official Mongoose Documentation clicking [here](https://docs.mongodb.org/manual/tutorial/model-tree-structures-with-ancestors-array/) to know more about that.

- Ok, nice introduction, but... What do you do with your module? 
- Well, let's find out! 

Let's say that you liked the Mongoose Structure described above. Now, you want to implement it, as a way to easily go through all the parents of your document without a recursive function or a complicated query, but... 
What do you need to do? 
Yes, you have to keep track by yourself of all the modifications in your collection, knowing everytime a parent changes, it's deleted, or know when a element's parent is edited in the tree. 

## So, what does mongoose-tree-ancestors do?
It just keeps track of all the changes for you. It's hooked to all the mongoose operations (update, findOneAndUpdate, save, remove and findOneAndRemove). 

Everytime you do an operation over a document with a parent, this module will keep updated the array of ancestors for each of them.

Now, let's see how to use it...

# Installation

```
npm install mongoose-tree-ancestors --save
```

# Usage
Just include the call to this module in the same place you declare your Mongoose Schema: 

```js

'use strict';

const mongoose = require('mongoose');
const mongooseTreeAncestors = utils.mongooseTreeAncestors;

const modelName = 'product_category';
const schema = new mongoose.Schema({
	// Not required, but it's useful to keep awareness of this field
	parent: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'group'
	},
	// Not required, but it's useful to keep awareness of this field
	ancestors: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: 'group'
	}],


	categoryName: String,
	createdAt: {
		type: Date,
		default: Date.now
	},
	updatedAt: Date
}, {
	collection: 'products_categories',
	timestamps: true
});

/**
 * Add the mongooseTreeAncestors Plugin to the schema
 */
mongooseTreeAncestors(schema, {
	// Set the parent field name and model reference
	parentFieldName: 'parent',
	parentFieldRefModel: modelName,

	// Set the ancestors field name and model reference
	ancestorsFieldName: 'ancestors',
	ancestorsFieldRefModel: modelName
});

module.exports = mongoose.model(modelName, schema);

``` 


After that, you will have implemented an automated model to handle the data in the `ancestor`'s field.

### NOTE 
If you already have a `parent` field, you can call the status method `buildAncestors` to build (or rebuild) all your ancestor's structure

```js

yourModel.buildAncestors();
```

# TODO: 
* Method setParent
* Method isRoot
* Method isLeaf
* Method isDescendant
* Method isSibling
* Method getFullTree
