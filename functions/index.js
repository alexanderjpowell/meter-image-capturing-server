'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const path = require('path');
const os = require('os');
const fs = require('fs');
const readline = require('readline');
const sgMail = require('@sendgrid/mail');
const region = 'us-central1';
const defaultBucket = 'meter-image-capturing.appspot.com';

admin.initializeApp();

const runtimeOpts = {
	timeoutSeconds: 540 // 9 minutes is max timeout
};

const defaultRuntimeOpts = {
	timeoutSeconds: 60
};

exports.adminTrigger = functions.runWith(defaultRuntimeOpts).region(region).firestore
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

	});


exports.testTrigger = functions.runWith(defaultRuntimeOpts).region(region).firestore
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

	});

function sendEmail(emailRecipient, subject, text, html) {

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

}

async function getUidByEmail(email) {
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
}

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
						}
						arrayData.push(objectData);
					}
					line_no++;
				});

				rl.on('close', (line) => {
					console.log('Total lines : ' + line_no);
					let data = {
						uploadArray: arrayData,
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





