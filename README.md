# mongoose-tree-ancestors - Introduction

Do you ever wanted to integrate a Tree Structure with documents refering to a parent, and the parent of the parent, avoiding a recursive function? Probably not, but if you ever think about that, you will be loosing a lot of time. 

Instead of that, you can apply a data structure called ** Mongoose Tree Structure with an Array of Ancestors ** . What's that? 

Take a look in the official Mongoose Documentation clicking [here](https://docs.mongodb.org/manual/tutorial/model-tree-structures-with-ancestors-array/) to know more about that.

- Ok, nice introduction, but... What does your module do? 
- Well, let's say you are implementing the Mongoose Structure described above. Now, you will need to keep updated an array with all the ancestors, in each of the documents. 
- Wait, but if I do that, I'll have to update everything everytime I do a change in the tree structure :(
- Yes, you will have to keep track by yourself of all the modifications in your collection, knowing everytime a parent changes, it's deleted, or it's edited in the tree. 

## Ok, just tell me what does mongoose-tree-ancestors do already!

It keeps track of all the changes for you. It's hooked to all the mongoose operations (update, findOneAndUpdate, save, remove and findOneAndRemove) you do through your model. 

Everytime you do an operation over a document, this module will keep updated the array of ancestors for you.

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
const mongooseTreeAncestors = require('mongoose-tree-ancestors');

// Declare a Model name
const modelName = 'product_category';

// Prepare the Schema
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

// Add the mongooseTreeAncestors Plugin to the schema 
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
Probably https://github.com/substack/js-traverse is a good option to make all this happen
