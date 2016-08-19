'use strict';

/**
 * Mongoose Tree Structure with an Array of Ancestors plugin for mongoose.
 *
 * https://docs.mongodb.org/manual/tutorial/model-tree-structures-with-ancestors-array/
 *
 * Based in https://github.com/janez89/mongoose-materialized
 */

const mongoose = require('mongoose');
const async = require('async');
const _ = require('lodash');

/**
 * Mongoose Tree Sructure with an Array of Ancestors path plugin
 */
function treeAncestors(schema, options) {
	options = _.assign({
		// Parent field defaults
		parentFieldName: 'parent',
		parentFieldType: mongoose.Schema.Types.ObjectId,
		parentFieldRefModel: null,
		parentIdFieldName: '_id',
		// Ancestors field defaults
		ancestorsFieldName: 'ancestors',
		ancestorsFieldType: mongoose.Schema.Types.ObjectId,
		ancestorsFieldRefModel: null,

		generateIndexes: false,
		// TODO: Revisar si es necesario
		mapLimit: 5
	}, options);

	// Save some option variables in a more legible variable name
	let id = options.parentIdFieldName;
	let parentId = options.parentFieldName;
	let ancestors = options.ancestorsFieldName;

	function byId(value) {
		let cond = {};
		cond[options.parentIdFieldName] = value;
		return cond;
	}

	// Add parent field
	if (!(parentId in schema.paths)) {
		let schemaParentField = {};
		schemaParentField[parentId] = {
			type: options.parentFieldType,
			'default': null
		}
		if (options.parentFieldRefModel) {
			schemaParentField[parentId].ref = options.parentFieldRefModel;
		}
		schema.add(schemaParentField);
	}

	// Add ancestors field
	if (!(ancestors in schema.paths)) {
		let schemaAncestorsField = objProperty(ancestors, [{
			type: options.ancestorsFieldType
		}]);
		if (options.ancestorsFieldRefModel) {
			schemaAncestorsField[ancestors][0].ref = options.ancestorsFieldRefModel;
		}

		schema.add(schemaAncestorsField);
	}

	if (options.generateIndexes) {
		// Add parent field index
		let parentFieldIndex = {};
		parentFieldIndex[parentId] = 1;
		schema.index(parentFieldIndex);

		// Add ancestors field index
		let ancestorsFieldIndex = {};
		ancestorsFieldIndex[ancestors] = 1;
		schema.index(ancestorsFieldIndex);
	}

	schema.post('update', function(docs, done) {

		/**
		 * A find with filter {} here will find all the elements affected by the update
		 */
		this.find({}).exec(function(err, data) {
			// Iterate over the found elements updating it's childrens
			async.eachSeries(data,
				function(doc, cb) {
					_updatedDocument(doc, cb);
				},
				function(err) {
					if (err) {
						return done(err);
					}
					done();
				});
		});
	});

	schema.post('findOneAndUpdate', function(doc, done) {
		_updatedDocument(doc, done);
	});

	schema.pre('save', function(next) {
		let self = this;
		let isParentIdChange = self.isModified(parentId);

		// Updates do not affect structure
		if (!self.isNew && !isParentIdChange) {
			return next();
		}

		/**
		 * A NEW ELEMENT WITHOUT A PARENT IS CREATED
		 * Description: If a new element is created, but it doesn't have any parent, set an empty 
		 * array of ancestors
		 */
		if (self.isNew && !self[parentId]) {
			this[ancestors] = [];
			this[parentId] = null;
			return next();
		}

		/**
		 * A NEW ELEMENT WITH A PARENT IS CREATED or AN EXISTING ELEMENT IS UPDATED
		 * Description: 
		 * 	If a new element is created, it must save the array with all the ancestors
		 * 	
		 * 	If an existing element is updated, and there're changes in it's parents,
		 *  the element must update it's ancestors and all the childrens should do the same
		 */
		if ((self.isNew && self[parentId]) || (!self.isNew && isParentIdChange)) {
			return _updatedDocument(self, next);
		} else {
			return next();
		}

	});

	/**
	 * This method applies when a document is being removed like this:
	 * var document = model.findOne({[params]})
	 * document.remove()
	 */
	schema.pre('findOneAndRemove', function(next) {
		let self = this;
		self.findOne({}).exec(function(err, documentToBeRemoved) {
			// Check for errors
			if (err) {
				return next(err);
			}
			// Try to remove the document
			_deleteDocument(documentToBeRemoved, next);
		});

	})

	/**
	 * This method applies when a document is being removed like this:
	 * var document = model.findOne({[params]})
	 * document.remove()
	 */
	schema.pre('remove', function(doc) {
		this.constructor.findOne({
			_id: this._id
		}).exec(function(err, data) {
			_deleteDocument(data, doc);
		});
	})

	/**
	 * This method applies when a document is being removed like this:
	 * model.remove({[params]})
	 */
	schema.static('remove', function(conditions, callback) {
		if ('function' === typeof conditions) {
			callback = conditions;
			conditions = {};
		}

		let self = this;
		let promise = new mongoose.Promise;
		if (typeof callback === 'function')
			promise.addBack(callback);

		self.find(conditions).exec(function(err, docs) {
			async.mapLimit(docs, options.mapLimit, function(doc, cbNext) {
				_deleteDocument(doc, cbNext);
			}, function(err) {
				if (err)
					return promise.error(err);
				promise.complete();
			});
		});
		return promise;
	});

	// Base method (not sure if works properly)
	// schema.method('getParent', function(callback) {
	// 	let promise = new mongoose.Promise;
	// 	if (callback) promise.addBack(callback);
	// 	let self = this;
	// 	self.constructor.findOne(byId(self[parentId]), function(err, doc) {
	// 		if (err || !doc)
	// 			promise.error(err);
	// 		else
	// 			promise.complete(doc);
	// 	});
	// 	return promise;
	// });

	// --- Build array with ancestors --------------------------------------------------------
	schema.static('buildAncestors', function(callback) {

		let self = this;
		let promise = new mongoose.Promise;
		if (typeof callback === 'function') {
			promise.addBack(callback);
		}

		let updateChildren = function(pDocs, cbFinish) {
			async.mapLimit(pDocs, options.mapLimit, function(parent, cbNext) {

				// update children
				let parentAncestors = parent[ancestors];
				let ancestorsArray = (parentAncestors && parentAncestors.push(parent._id) && parentAncestors) || [];

				self.update(objProperty(parentId, parent._id), objProperty(ancestors, ancestorsArray), {
					multi: true
				}, function(err) {
					if (err) {
						return cbNext(err);
					}
					// after updated
					self.find(objProperty(parentId, parent._id)).exec(function(err, docs) {
						if (docs.length === 0)
							return cbNext(null);

						updateChildren(docs, function(err) {
							if (err) {
								return cbNext(err);
							}
							cbNext(null);
						});
					});
				});
			}, function(err) {
				if (err) {
					return cbFinish(err);
				}
				cbFinish(null);
			});
		};

		self.find(objProperty(parentId, null)).exec(function(err, docs) {
			// clear path
			self.update(objProperty(parentId, null), objProperty(ancestors, []), {
				multi: true
			}, function() {
				updateChildren(docs, function() {
					promise.complete();
				});
			});
		});

		return promise;
	});

	function _updatedDocument(doc, next) {

		let updateChilds = function() {

			doc.constructor.find(objProperty(ancestors, doc[id])).exec(function(err, docs) {

				// update documents
				async.map(docs, function(childrenDoc, cbNext) {

					// Remove all the ancestors that now are not ancestors
					let newAncestors = _.dropWhile(childrenDoc[ancestors], function(elementId) {

						return elementId.toString() !== doc[id].toString();
					});
					childrenDoc[ancestors] = _.concat(doc[ancestors], newAncestors);

					childrenDoc.save(function(err, data) {
						cbNext(err, data);
					});
				}, function(err) {
					next(err);
				});
			});
		};

		// Save data and update childrens
		if (!doc[parentId]) {
			doc[ancestors] = [];
			doc.save();
			// Update childrens
			updateChilds();
		} else {
			doc.constructor.findOne(byId(doc[parentId])).exec(function(err, newParent) {
				if (err || !newParent) {
					doc.invalidate(parentId, 'Parent not found!');
					return next(new Error('Parent not found!'));
				}

				let parentAncestors = newParent[ancestors];
				let ancestorsArray = (parentAncestors && parentAncestors.push(newParent._id) && parentAncestors) || [];
				doc[ancestors] = ancestorsArray;
				doc.save();
				// update childs
				updateChilds();
			});
		}
	}

	function _deleteDocument(doc, next) {
		// Check if there are childrens depending on the document that will be removed
		if (doc) {
			doc.constructor.find({
				ancestors: doc._id
			}).exec(function(e, data) {
				if (e) {
					return next(e);
				}
				// If there are no childrens depending on it, proceed with the document removal
				if (!data.length) {
					next();
				}
				// If the document has childrens depending on it, don't allow the removal
				else {
					let err = new Error('It\'s not possible to delete this document with id "' + doc._id + '". It has ' + data.length + ' childrens depending on it');
					err.childrens = _.map(data, '_id');
					next(err);
				}
			});
		} else {
			next();
		}

	}

}

function objProperty(property, value, obj) {
	obj = obj || {};
	obj[property] = value;
	return obj;
}

module.exports = treeAncestors;
