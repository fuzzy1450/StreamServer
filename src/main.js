const {google} = require('googleapis');
const crypto = require('crypto');
const { spawn } = require('node:child_process');

const express = require('express')
const session = require('express-session');
const fs = require('fs');
const http = require('http');
const https = require('https');

const HTTPport = 8080
const HTTPSPort = 8443

const privateKey  = fs.readFileSync('auth/selfsign.key', 'utf8');
const certificate = fs.readFileSync('auth/selfsign.crt', 'utf8');
const credentials = {key: privateKey, cert: certificate};
 
const secrets = require("auth/client_secrets.json");
const oauth2Client = new google.auth.OAuth2(
	secrets.web.client_id,
	secrets.web.client_secret,
	secrets.web.redirect_uris[0]
);


const app = express()
app.use(session({
	secret: crypto.randomBytes(32).toString('hex'),
	resave: false,
	saveUninitialized: true,
	cookie: { secure: true }
}))

let ytcode = null



app.set('view engine', 'ejs');

app.get('/init', (req, res) => {
	
	// Generate a secure random state value.
	const state = crypto.randomBytes(32).toString('hex');

	// Store state in the session
	req.session.state = state;

	// Generate a url that asks permissions for the Drive activity scope
	const authorizationUrl = oauth2Client.generateAuthUrl({
		// 'online' (default) or 'offline' (gets refresh_token)
		access_type: 'offline',
		/** Pass in the scopes array defined above.
		* Alternatively, if only one scope is needed, you can pass a scope URL as a string */
		scope: 'https://www.googleapis.com/auth/youtube',
		// Enable incremental authorization. Recommended as a best practice.
		include_granted_scopes: true,
		// Include the state parameter to reduce the risk of CSRF attacks.
		state: state
	});
	
	res.redirect(authorizationUrl)
})

app.get('/oauth', (req,res)=>{
	if(!req.query.code){
		res.redirect('/init')
	}
	ytcode = req.query.code
	
	console.log(ytcode)
	res.send(`<h1>Which one should go live?</h1>
			<a href='/golive/1'>Camera 1</a>
			<br>
			<a href='/golive/2'>Camera 2</a>
	`)
})
app.get('/golive', (req,res)=>{
	if(ytcode){
		res.send(`<h1>Which one should go live?</h1>
			<a href='/golive/1'>Camera 1</a>
			<br>
			<a href='/golive/2'>Camera 2</a>
	`)
	} else {
		res.redirect('/init')
	}
})


app.get('/golive/:camID', async (req,res)=>{
	if(!ytcode){
		res.redirect('/init')
		return
	}
	console.log("Initiating the Stream Process...")
	
	try {
		const { tokens } = await oauth2Client.getToken(ytcode);
		oauth2Client.setCredentials(tokens);

		// Create live broadcast
		const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
		const broadcastResponse = await youtube.liveBroadcasts.insert({
		  part: 'snippet,status',
		  requestBody: {
			snippet: {
			  title: 'New Live Broadcast',
			  scheduledStartTime: new Date().toISOString()
			},
			status: {
			  privacyStatus: 'public'
			}
		  }
		});

		const broadcastId = broadcastResponse.data.id;

		// Create live stream
		const streamResponse = await youtube.liveStreams.insert({
		  part: 'snippet,cdn',
		  requestBody: {
			snippet: {
			  title: 'New Live Stream'
			},
			cdn: {
			  resolution: '1080p',
			  ingestionType: 'rtmp',
			  frameRate:'30fps'
			}
		  }
		});

		const streamId = streamResponse.data.id;

		// Bind broadcast and stream
		await youtube.liveBroadcasts.bind({
		  part: 'id,contentDetails',
		  id: broadcastId,
		  streamId: streamId
		});


		//TODO update stream 
		
		let StreamKey = streamResponse.data.cdn.ingestionInfo.streamName
		let Addr = streamResponse.data.cdn.ingestionInfo.ingestionAddress
		
		
		StartStream(StreamKey, Addr, req.param("camID"))
		
		console.log('Livestream created successfully!');
		res.redirect(`http://youtube.com/watch?v=${broadcastResponse.data.id}`)
	} 
	catch (error) {
		console.error('Error creating livestream:', error);
		res.status(500).send('Error creating livestream');
	}
})

async function StartStream(StreamKey, StreamAddr, Source){
	
	if(Source==1){
		Source = "rtsp://admin:spot9666@192.168.50.225:554/h264Preview_07_main"
	} else if (Source==2){
		Source = "rtsp://admin:spot9666@192.168.50.216:554/h264Preview_07_main"
	} else {
		throw Error("Camera not specified!")
	}
	
	destination = StreamAddr+'/'+StreamKey
	console.log(`Starting Stream to [${destination}]`)
	
	proc = spawn('ffmpeg.exe', [
		'-hwaccel', 'cuda',
		'-rtsp_transport', 'tcp',
		'-r', '25',
		'-i', Source,
		'-c:v', 'hevc_nvenc', 
		'-b:v', '6200k',
		'-pix_fmt', 'yuv420p',
		'-c:a', 'aac',
		'-r', '30',
		'-f', 'flv',
		destination
        
    ]);
	if(proc.error) {
		console.log("ERROR: ",child.error);
	}
	
	console.log("FFMPEG Running...")
	proc.stdout.on('data', (data) => {
		console.log(`FFMPEG o: ${data}`);
	});
	proc.stderr.on('data', function(data) {
        console.log(`FFMPEG e: ${data}`);
    });
	proc.on('close', (code) => {
		console.log(`FFMPEG process exited with code ${code}`);
	}); 
	console.log(proc)
}

const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);

httpServer.listen(8080, ()=>console.log("HTTP Server listening on port 8080"));
httpsServer.listen(8443, ()=>console.log("HTTPS Server listening on port 8443"));
