'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const path = require('path');
const os = require('os');
const fs = require('fs');
const readline = require('readline');
const region = 'us-central1';
const defaultBucket = 'meter-image-capturing.appspot.com';
const toDoFilesBucket = 'to-do-files';

admin.initializeApp();
const db = admin.firestore();

const runtimeOpts = {
	timeoutSeconds: 540 // 9 minutes is max timeout
};

const defaultRuntimeOpts = {
	timeoutSeconds: 60
};

exports.resetUploadFile = functions.https.onCall(async(data, context) => {
	const uid = context.auth.uid;
	console.log("UID: " + uid);
	const docId = data.doc_id;
	if (!docId) {
		console.log("empty doc id");
		return false;
	}
	const colRef = db.collection('toDoFileData').doc(uid).collection('files').doc(docId).collection('machines');
	const snapshot = await colRef.get();
	//
	let countUnscanned = 0;
	snapshot.docs.forEach((doc) => {
		if (doc.data()["isScanned"] === false) {
			countUnscanned++;
		}
	});
	if (countUnscanned >= 2) { // safeguard in case function gets called erroneously
		console.log("premature reset function call");
		return false;
	}
	//
	let count = 1;
	const batches = [];
	let batch = db.batch();
	snapshot.docs.forEach((doc) => {
		batch.update(doc.ref, { isScanned: false });
		if (((count % 500) === 0) || (count === snapshot.size)) {
			batches.push(batch.commit());
			batch = db.batch(); // Reset batch
		}
		count++;
	});

	const docRef = db.collection('toDoFileData').doc(uid).collection('files').doc(docId);
	batches.push(docRef.update({ initializedScanning: true }));
	return Promise.all(batches).then(snapshot => {
		return true;
	}).catch((error) => {
        throw new functions.https.HttpsError('reset-error', error.message);
    });
});

// exports.scheduledFunction = functions.pubsub.schedule('1 of month 12:00').timeZone('America/New_York').onRun((context) => {
// 	console.log('Test function');
// 	const usersCollectionRef = await admin.firestore().collection('users').get();
// 	return null;
// });

/*exports.adminTrigger = functions.runWith(defaultRuntimeOpts).region(region).firestore
	.document('users/{userId}')
	.onWrite((change, context) => {

		const oldValues = change.before.data();
		const newValues = change.after.data();
		const userId = context.params.userId;

		const oldAdminEmail = oldValues.adminEmail;
		const adminEmail = newValues.adminEmail;
		const casinoName = newValues.casinoName;
		//if (!casinoName) {
		//	casinoName = 
		//}

		// Break out if there is no change to the admin email
		if (oldAdminEmail === adminEmail) return null;

		// Revoke privileges for old admin email if it exists
		if (oldAdminEmail) {
			admin.firestore().collection('admins').doc(oldAdminEmail).collection('casinos').doc(userId).delete();
		}

		// Set permissions and create new accounts if necessary
		if (adminEmail) {

			// Get admin uid -> adminUID
			// First, if old admin email has permissions to view {userId} account
			// check if admins/{adminUID}/casinos/{userId} exists
			admin.auth().getUserByEmail(adminEmail)
				.then((userRecord) => {
					const uid = userRecord.toJSON().uid;

					let text = 'You have been given admin access to ' + casinoName;
					let html = '<h3>' + text + '</h3>';
					sendEmail(adminEmail, casinoName + ' has listed you an administrator', text, html);
					//.catch((error) => {
					//	console.log(error);
					//});

					let data = { casinoName: casinoName };
					//
					let docRef = admin.firestore().collection('admins').doc(adminEmail);
					docRef.set({ adminUID: uid }, {merge: true});
					//
					let documentRef = admin.firestore().collection('admins').doc(adminEmail).collection('casinos').doc(userId);
					return documentRef.set(data, {merge: true});
				})
				.catch((error) => {
					if (error.code === 'auth/user-not-found') {
						//Create the user in auth
						let password = '12345678';
						let userData = { 
							email: adminEmail,
							password: password
						};
						admin.auth().createUser(userData)
							.then((userRecord) => {
								let uid = userRecord.toJSON().uid;
								// Send email to new user with their password
								let text = 'Your password is: ' + password + '\n\nThis can be reset in the mobile app.';
								text = text + '\n\nYou have been given admin access to ' + casinoName;
								let html = '<h3>' + text + '</h3>';
								sendEmail(adminEmail, 'Welcome to Meter Image Capturing', text, html);
								//.catch((error) => {
								//	console.log(error);
								//});

								// Write to db
								let data = { casinoName: casinoName };
								//
								let docRef = admin.firestore().collection('admins').doc(adminEmail);
								docRef.set({ adminUID: uid }, {merge: true});
								//
								let documentRef = admin.firestore().collection('admins').doc(adminEmail).collection('casinos').doc(userId);
								return documentRef.set(data, {merge: true});
							})
							.catch((error) => {
								console.log('Error creating new user:', error);
								return 0;
							});
					}
					return 0;
				});

			// Check if the email exists in firebase auth as an admin account
			// If it does exist, get the uid and create a new document in the casinos collection
			// If it doesn't already exist create a new user and add to the admins collection in firestore
			//return null;
		}
		return null;

	});*/


/*exports.testTrigger = functions.runWith(defaultRuntimeOpts).region(region).firestore
	.document('users/{userId}')
	.onWrite((change, context) => {

		let SENDGRID_API_KEY = '<SENDGRID_API_KEY>';

		sgMail.setApiKey(SENDGRID_API_KEY);
		const msg = {
			to: '',
			from: '',
			subject: 'Sending with Twilio SendGrid is Fun',
			text: 'and easy to do anywhere, even with Node.js',
			html: '<strong>and easy to do anywhere, even with Node.js</strong>',
		};
		return sgMail.send(msg).catch((error) => {
			console.log(error)
		});

		//return 1;

	});*/

/*function sendEmail(emailRecipient, subject, text, html) {

	let SENDGRID_API_KEY = '<SENDGRID_API_KEY>';
	sgMail.setApiKey(SENDGRID_API_KEY);
	const msg = {
		to: emailRecipient,
		from: 'ajpowell@email.wm.edu',
		subject: subject,
		text: text,
		html: html,
	};
	return sgMail.send(msg).catch((error) => {
		console.log(error)
	});

}*/

/*async function getUidByEmail(email) {
	let userRecord = await admin.auth().getUserByEmail(email).catch((error) => {return 0;});
	if (userRecord) {
		let uid = userRecord.toJSON().uid;
		//console.log(uid);
		//console.log(userRecord);
		return Promise.resolve(uid);
	} else {
		console.log('user doesn\'t exist');
		return Promise.resolve(0);
	}
}*/

exports.importToDoFileToFirestore = functions.runWith(runtimeOpts).region(region).storage.bucket(toDoFilesBucket).object().onFinalize(async(object) => {
	try {
		const fileBucket = object.bucket;
		const filePath = object.name;
		//const contentType = object.contentType;
		//const metageneration = object.metageneration;

		const fileName = path.basename(filePath);
		const bucket = admin.storage().bucket(fileBucket);
		/*const tempFilePath = path.join(os.tmpdir(), fileName);
		const metadata = {
			contentType: contentType,
		};*/

		const remoteFile = bucket.file(filePath);

		// filename is <uid>.csv
		const uid = path.parse(fileName).name;
		const localFileName = '/tmp/' + fileName;

		const stream = remoteFile.createReadStream();

		return new Promise((resolve, reject) => {

			stream.on('error', (error) => {
				console.log('error reading file: ', error);
				reject(error);
			})
			.on('data', (chunk) => {
				//console.log('data');
				//console.log(chunk.toString());
			})
			.on('finish', () => {
				console.log('finish');
			})
			.on('end', () => {
				console.log('end');

				let rl = readline.createInterface({
					input: fs.createReadStream(localFileName)
				});

				let line_no = 0;
				let arrayData = [];

				let locationIndex;
				let machineIdIndex;
				let descriptionIndex;
				let userIndex;
				let progressiveCountIndex;
				let p1Index, p2Index, p3Index, p4Index, p5Index, p6Index, p7Index, p8Index, p9Index, p10Index;
				//let r1Index, r2Index, r3Index, r4Index, r5Index, r6Index, r7Index, r8Index, r9Index, r10Index;
				//
				let b1Index, b2Index, b3Index, b4Index, b5Index, b6Index, b7Index, b8Index, b9Index, b10Index;
				let i1Index, i2Index, i3Index, i4Index, i5Index, i6Index, i7Index, i8Index, i9Index, i10Index;
				//

				rl.on('line', (line) => {
					//let x = line.split(',');
					let x = CSVToArray(line, ',')[0];

					if (line_no === 0) {
						// Required headers
						if (!x.includes('location') || !x.includes('machine_id') || !x.includes('description')) {
							return;
						}
						locationIndex = x.indexOf('location');
						machineIdIndex = x.indexOf('machine_id');
						descriptionIndex = x.indexOf('description');
						// Optional headers
						if (x.includes('user')) {
							userIndex = x.indexOf('user');
						}
						if (x.includes('progressive_count')) {
							progressiveCountIndex = x.indexOf('progressive_count');
						}
						if (x.includes('p_1')) {
							p1Index = x.indexOf('p_1');
						}
						if (x.includes('p_2')) {
							p2Index = x.indexOf('p_2');
						}
						if (x.includes('p_3')) {
							p3Index = x.indexOf('p_3');
						}
						if (x.includes('p_4')) {
							p4Index = x.indexOf('p_4');
						}
						if (x.includes('p_5')) {
							p5Index = x.indexOf('p_5');
						}
						if (x.includes('p_6')) {
							p6Index = x.indexOf('p_6');
						}
						if (x.includes('p_7')) {
							p7Index = x.indexOf('p_7');
						}
						if (x.includes('p_8')) {
							p8Index = x.indexOf('p_8');
						}
						if (x.includes('p_9')) {
							p9Index = x.indexOf('p_9');
						}
						if (x.includes('p_10')) {
							p10Index = x.indexOf('p_10');
						}

						//
						/*if (x.includes('r_1')) {
							r1Index = x.indexOf('r_1');
						}
						if (x.includes('r_2')) {
							r2Index = x.indexOf('r_2');
						}
						if (x.includes('r_3')) {
							r3Index = x.indexOf('r_3');
						}
						if (x.includes('r_4')) {
							r4Index = x.indexOf('r_4');
						}
						if (x.includes('r_5')) {
							r5Index = x.indexOf('r_5');
						}
						if (x.includes('r_6')) {
							r6Index = x.indexOf('r_6');
						}
						if (x.includes('r_7')) {
							r7Index = x.indexOf('r_7');
						}
						if (x.includes('r_8')) {
							r8Index = x.indexOf('r_8');
						}
						if (x.includes('r_9')) {
							r9Index = x.indexOf('r_9');
						}
						if (x.includes('r_10')) {
							r10Index = x.indexOf('r_10');
						}*/
						//

						//
						if (x.includes('b_1')) {
							b1Index = x.indexOf('b_1');
						}
						if (x.includes('b_2')) {
							b2Index = x.indexOf('b_2');
						}
						if (x.includes('b_3')) {
							b3Index = x.indexOf('b_3');
						}
						if (x.includes('b_4')) {
							b4Index = x.indexOf('b_4');
						}
						if (x.includes('b_5')) {
							b5Index = x.indexOf('b_5');
						}
						if (x.includes('b_6')) {
							b6Index = x.indexOf('b_6');
						}
						if (x.includes('b_7')) {
							b7Index = x.indexOf('b_7');
						}
						if (x.includes('b_8')) {
							b8Index = x.indexOf('b_8');
						}
						if (x.includes('b_9')) {
							b9Index = x.indexOf('b_9');
						}
						if (x.includes('b_10')) {
							b10Index = x.indexOf('b_10');
						}
						//

						//
						if (x.includes('i_1')) {
							i1Index = x.indexOf('i_1');
						}
						if (x.includes('i_2')) {
							i2Index = x.indexOf('i_2');
						}
						if (x.includes('i_3')) {
							i3Index = x.indexOf('i_3');
						}
						if (x.includes('i_4')) {
							i4Index = x.indexOf('i_4');
						}
						if (x.includes('i_5')) {
							i5Index = x.indexOf('i_5');
						}
						if (x.includes('i_6')) {
							i6Index = x.indexOf('i_6');
						}
						if (x.includes('i_7')) {
							i7Index = x.indexOf('i_7');
						}
						if (x.includes('i_8')) {
							i8Index = x.indexOf('i_8');
						}
						if (x.includes('i_9')) {
							i9Index = x.indexOf('i_9');
						}
						if (x.includes('i_10')) {
							i10Index = x.indexOf('i_10');
						}
						//
					}
					else {
						let objectData = {
							l: x[locationIndex],
							m: x[machineIdIndex],
							d: x[descriptionIndex]
						};
						if (userIndex !== undefined) {
							objectData['u'] = x[userIndex];
						}
						let progressiveDescriptionsArray = [];
						if (p1Index !== undefined) { progressiveDescriptionsArray.push(x[p1Index]); }
						if (p2Index !== undefined) { progressiveDescriptionsArray.push(x[p2Index]); }
						if (p3Index !== undefined) { progressiveDescriptionsArray.push(x[p3Index]); }
						if (p4Index !== undefined) { progressiveDescriptionsArray.push(x[p4Index]); }
						if (p5Index !== undefined) { progressiveDescriptionsArray.push(x[p5Index]); }
						if (p6Index !== undefined) { progressiveDescriptionsArray.push(x[p6Index]); }
						if (p7Index !== undefined) { progressiveDescriptionsArray.push(x[p7Index]); }
						if (p8Index !== undefined) { progressiveDescriptionsArray.push(x[p8Index]); }
						if (p9Index !== undefined) { progressiveDescriptionsArray.push(x[p9Index]); }
						if (p10Index !== undefined) { progressiveDescriptionsArray.push(x[p10Index]); }
						if (progressiveDescriptionsArray.length > 0) {
							objectData['da'] = progressiveDescriptionsArray;
						} else {
							objectData['da'] = [];
						}
						//
						/*let resetValuesArray = [];
						if (r1Index !== undefined) { resetValuesArray.push(x[r1Index]); }
						if (r2Index !== undefined) { resetValuesArray.push(x[r2Index]); }
						if (r3Index !== undefined) { resetValuesArray.push(x[r3Index]); }
						if (r4Index !== undefined) { resetValuesArray.push(x[r4Index]); }
						if (r5Index !== undefined) { resetValuesArray.push(x[r5Index]); }
						if (r6Index !== undefined) { resetValuesArray.push(x[r6Index]); }
						if (r7Index !== undefined) { resetValuesArray.push(x[r7Index]); }
						if (r8Index !== undefined) { resetValuesArray.push(x[r8Index]); }
						if (r9Index !== undefined) { resetValuesArray.push(x[r9Index]); }
						if (r10Index !== undefined) { resetValuesArray.push(x[r10Index]); }
						if (resetValuesArray.length > 0) {
							objectData['ra'] = resetValuesArray;
						} else {
							objectData['ra'] = [];
						}*/
						//
						//
						let baseValuesArray = [];
						if (b1Index !== undefined) { baseValuesArray.push(x[b1Index]); }
						if (b2Index !== undefined) { baseValuesArray.push(x[b2Index]); }
						if (b3Index !== undefined) { baseValuesArray.push(x[b3Index]); }
						if (b4Index !== undefined) { baseValuesArray.push(x[b4Index]); }
						if (b5Index !== undefined) { baseValuesArray.push(x[b5Index]); }
						if (b6Index !== undefined) { baseValuesArray.push(x[b6Index]); }
						if (b7Index !== undefined) { baseValuesArray.push(x[b7Index]); }
						if (b8Index !== undefined) { baseValuesArray.push(x[b8Index]); }
						if (b9Index !== undefined) { baseValuesArray.push(x[b9Index]); }
						if (b10Index !== undefined) { baseValuesArray.push(x[b10Index]); }
						if (baseValuesArray.length > 0) {
							objectData['ba'] = baseValuesArray;
						} else {
							objectData['ba'] = [];
						}
						//
						//
						let incrementValuesArray = [];
						if (i1Index !== undefined) { incrementValuesArray.push(x[i1Index]); }
						if (i2Index !== undefined) { incrementValuesArray.push(x[i2Index]); }
						if (i3Index !== undefined) { incrementValuesArray.push(x[i3Index]); }
						if (i4Index !== undefined) { incrementValuesArray.push(x[i4Index]); }
						if (i5Index !== undefined) { incrementValuesArray.push(x[i5Index]); }
						if (i6Index !== undefined) { incrementValuesArray.push(x[i6Index]); }
						if (i7Index !== undefined) { incrementValuesArray.push(x[i7Index]); }
						if (i8Index !== undefined) { incrementValuesArray.push(x[i8Index]); }
						if (i9Index !== undefined) { incrementValuesArray.push(x[i9Index]); }
						if (i10Index !== undefined) { incrementValuesArray.push(x[i10Index]); }
						if (incrementValuesArray.length > 0) {
							objectData['ia'] = incrementValuesArray;
						} else {
							objectData['ia'] = [];
						}
						//

						arrayData.push(objectData);
					}
					line_no++;
				});

				rl.on('close', (line) => {
					console.log('Total lines : ' + line_no);
					let data = {
						uploadArray: arrayData,
						rowCount: line_no - 1, // Don't count header row
						timestamp: admin.firestore.FieldValue.serverTimestamp()
					};
					let documentRef = admin.firestore().collection('formUploads').doc(uid);
					documentRef.set(data).then((res) => {
						console.log('document successfully created');
						resolve();
						return 1;
					})
					.catch((err) => {
						console.log(`Failed to create document: ${err}`);
						reject(err);
						return 0;
					});
					fs.unlinkSync(localFileName);
				});
			}).pipe(fs.createWriteStream(localFileName));
		});
	}
	catch (error) {
		console.log('catch error: ', error);
		return 0;
	}
});

exports.uploadToDatabase = functions.runWith(runtimeOpts).region(region).storage.bucket(defaultBucket).object().onFinalize(async (object) => {

	try {
		const fileBucket = object.bucket;
		const filePath = object.name;
		const contentType = object.contentType;
		const metageneration = object.metageneration;

		const fileName = path.basename(filePath);
		const bucket = admin.storage().bucket(fileBucket);
		const tempFilePath = path.join(os.tmpdir(), fileName);
		const metadata = {
			contentType: contentType,
		};

		const remoteFile = bucket.file(filePath);

		// filename is <uid>.csv
		const uid = path.parse(fileName).name;
		const localFileName = '/tmp/' + fileName;

		let collectionRef = admin.firestore().collection('formUploads').doc(uid).collection('uploadFormData');

		const stream = remoteFile.createReadStream();

		return new Promise((resolve, reject) => {

			stream.on('error', (error) => {
				console.log('error reading file: ', error);
				reject(error);
			})
			.on('data', (chunk) => {
				//console.log('data');
				//console.log(chunk.toString());
			})
			.on('finish', () => {
				console.log('finish');
			})
			.on('end', () => {
				console.log('end');

				let rl = readline.createInterface({
					input: fs.createReadStream(localFileName)
				});

				let line_no = 0;
				let arrayData = [];

				let locationIndex;
				let machineIdIndex;
				let descriptionIndex;
				let userIndex;
				let progressiveCountIndex;
				let p1Index, p2Index, p3Index, p4Index, p5Index, p6Index, p7Index, p8Index, p9Index, p10Index;

				rl.on('line', (line) => {
					//let x = line.split(',');
					let x = CSVToArray(line, ',')[0];

					if (line_no === 0) {
						// Required headers
						if (!x.includes('location') || !x.includes('machine_id') || !x.includes('description')) {
							return;
						}
						locationIndex = x.indexOf('location');
						machineIdIndex = x.indexOf('machine_id');
						descriptionIndex = x.indexOf('description');
						// Optional headers
						if (x.includes('user')) {
							userIndex = x.indexOf('user');
						}
						if (x.includes('progressive_count')) {
							progressiveCountIndex = x.indexOf('progressive_count');
						}
						if (x.includes('p_1')) {
							p1Index = x.indexOf('p_1');
						}
						if (x.includes('p_2')) {
							p2Index = x.indexOf('p_2');
						}
						if (x.includes('p_3')) {
							p3Index = x.indexOf('p_3');
						}
						if (x.includes('p_4')) {
							p4Index = x.indexOf('p_4');
						}
						if (x.includes('p_5')) {
							p5Index = x.indexOf('p_5');
						}
						if (x.includes('p_6')) {
							p6Index = x.indexOf('p_6');
						}
						if (x.includes('p_7')) {
							p7Index = x.indexOf('p_7');
						}
						if (x.includes('p_8')) {
							p8Index = x.indexOf('p_8');
						}
						if (x.includes('p_9')) {
							p9Index = x.indexOf('p_9');
						}
						if (x.includes('p_10')) {
							p10Index = x.indexOf('p_10');
						}
					}
					else {
						let objectData = {
							/*location: x[locationIndex],
							machine_id: x[machineIdIndex],
							description: x[descriptionIndex]*/
							l: x[locationIndex],
							m: x[machineIdIndex],
							d: x[descriptionIndex]
							//completed: false
						};
						if (userIndex !== undefined) {
							//objectData['user'] = x[userIndex];
							objectData['u'] = x[userIndex];
						}
						//if (progressiveCountIndex !== undefined) {
							//objectData['progressive_count'] = x[progressiveCountIndex];
						//}
						let progressiveDescriptionsArray = [];
						if (p1Index !== undefined) { progressiveDescriptionsArray.push(x[p1Index]); }
						if (p2Index !== undefined) { progressiveDescriptionsArray.push(x[p2Index]); }
						if (p3Index !== undefined) { progressiveDescriptionsArray.push(x[p3Index]); }
						if (p4Index !== undefined) { progressiveDescriptionsArray.push(x[p4Index]); }
						if (p5Index !== undefined) { progressiveDescriptionsArray.push(x[p5Index]); }
						if (p6Index !== undefined) { progressiveDescriptionsArray.push(x[p6Index]); }
						if (p7Index !== undefined) { progressiveDescriptionsArray.push(x[p7Index]); }
						if (p8Index !== undefined) { progressiveDescriptionsArray.push(x[p8Index]); }
						if (p9Index !== undefined) { progressiveDescriptionsArray.push(x[p9Index]); }
						if (p10Index !== undefined) { progressiveDescriptionsArray.push(x[p10Index]); }
						if (progressiveDescriptionsArray.length > 0) {
							//objectData['descriptionsArray'] = progressiveDescriptionsArray;
							objectData['da'] = progressiveDescriptionsArray;
						} else {
							objectData['da'] = [];
						}
						arrayData.push(objectData);
					}
					line_no++;
				});

				rl.on('close', (line) => {
					console.log('Total lines : ' + line_no);
					let data = {
						uploadArray: arrayData,
						rowCount: line_no,
						timestamp: admin.firestore.FieldValue.serverTimestamp()
					};
					let documentRef = admin.firestore().collection('formUploads').doc(uid);
					documentRef.set(data).then((res) => {
						console.log('document successfully created');
						resolve();
						return 1;
					})
					.catch((err) => {
						console.log(`Failed to create document: ${err}`);
						reject(err);
						return 0;
					});
					fs.unlinkSync(localFileName);
				});
			}).pipe(fs.createWriteStream(localFileName));
		});
	}
	catch (error) {
		console.log('catch error: ', error);
		return 0;
	}
});


// Borrowed from https://stackoverflow.com/questions/1293147/javascript-code-to-parse-csv-data
function CSVToArray(strData, strDelimiter) {
	// Check to see if the delimiter is defined. If not,
	// then default to comma.
	strDelimiter = (strDelimiter || ",");

	// Create a regular expression to parse the CSV values.
	var objPattern = new RegExp(
		(
			// Delimiters.
			"(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +

			// Quoted fields.
			"(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

			// Standard fields.
			"([^\"\\" + strDelimiter + "\\r\\n]*))"
		),
		"gi"
		);

	// Create an array to hold our data. Give the array
	// a default empty first row.
	var arrData = [[]];

	// Create an array to hold our individual pattern
	// matching groups.
	var arrMatches = null;

	// Keep looping over the regular expression matches
	// until we can no longer find a match.
	while ((arrMatches = objPattern.exec(strData))) {

		// Get the delimiter that was found.
		var strMatchedDelimiter = arrMatches[1];

		// Check to see if the given delimiter has a length
		// (is not the start of string) and if it matches
		// field delimiter. If id does not, then we know
		// that this delimiter is a row delimiter.
		if (strMatchedDelimiter.length && strMatchedDelimiter !== strDelimiter) {
			// Since we have reached a new row of data,
			// add an empty row to our data array.
			arrData.push([]);
		}

		var strMatchedValue;

		// Now that we have our delimiter out of the way,
		// let's check to see which kind of value we
		// captured (quoted or unquoted).
		if (arrMatches[2]) {
			// We found a quoted value. When we capture
			// this value, unescape any double quotes.
			strMatchedValue = arrMatches[2].replace(new RegExp( "\"\"", "g" ), "\"");
		} else {
			// We found a non-quoted value.
			strMatchedValue = arrMatches[3];
		}

		// Now that we have our value string, let's add
		// it to the data array.
		arrData[arrData.length - 1].push(strMatchedValue);
	}

	// Return the parsed data.
	return(arrData);
}





