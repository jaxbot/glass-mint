var https = require('https');
var constants = require('constants');

var config = require('./config.json');
config.callbacks = {
	newclient: onNewClient
};

var prism = require('glass-prism');

prism.init(config, function() {
	updateBankInfo();
	setInterval(updateBankInfo, config.updateFrequency * 60 * 1000);
});

function onNewClient(tokens) {
	updateBankInfo();
}

function updateBankInfo() {
	pullFromMintApi("/loginUserSubmit.xevent", function(err, data) {
		if (err) {
			console.log("Info: request failed: " + err);
			return;
		}
		var account = data.response["115485"].response[0];
		console.log(account.currentBalance);
		console.log(account.accountName);
		console.log(account.fiName);

		var html = prism.cards.main(account);
		prism.updateAllCards({ html: html, pinned: true, sourceItemId: "glass_mint" });
	});
}

function pullFromMintApi(path, callback) {
	var options = {
		hostname: 'wwws.mint.com',
		headers: { "Accept": "application/json", "Content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
		path: path,
		method: 'POST',
		agent:false,
		rejectUnauthorized:false,
		secureOptions: constants.SSL_OP_NO_TLSv1_2,
		strictSSL:false
	};

	var req = https.request(options, function(res) {
		var chunk = "";
		var loginData = {};

		res.on('data', function(hunk) {
			chunk += hunk.toString();
		});
		res.on('end', function() {
			try {
				loginData = JSON.parse(chunk);
			} catch (e) {
				callback(e);
				return;
			}

			options.path = "/bundledServiceController.xevent?token=" + loginData.sUser.token;

			options.headers["Cookie"] = "";

			for (var i = 0; i < res.headers['set-cookie'].length;i++) {
				options.headers["Cookie"] += res.headers['set-cookie'][i].split(';')[0].split('=')[0] + '=' + encodeURIComponent(res.headers['set-cookie'][i].split(';')[0].split('=')[1]) + "; ";
			}

			var query = https.request(options, function(res) {
				var data = "";

				res.on('data', function(chunk) {
					data += chunk.toString();
				});
				res.on('end', function() {
					try {
						callback(null, JSON.parse(data.toString()));
					} catch(e) {
						callback(e);
					}
				});
			});
			query.write("input="+encodeURIComponent(JSON.stringify([
				{
					"args": {
						"feature": "mintHB"
					},
					"service": "MintNewFeatureEnablementService",
					"task": "isEnabled",
					"id": "258168"
				},
				{
					args: {
						types: [
							"BANK"
						]
					},
					id: "115485",
					service: "MintAccountService",
					task: "getAccountsSorted"
				}
			])));
			query.end();
			query.on('error', function(err) {
				console.warn("Error in second call: " + err);
			});
		});
	});

	req.write("username=" + encodeURIComponent(config.mint_username) + "&task=L&password=" + encodeURIComponent(config.mint_password) + "&browser=chrome&browserVersion=33&os=win");
	req.end();
	req.on('error', function(err) {
		console.warn("Error: " + err);
	});

}

