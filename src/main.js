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
let ytcode = null
const oauth2Client = new google.auth.OAuth2(
	secrets.web.client_id,
	secrets.web.client_secret,
	secrets.web.redirect_uris[0]
);

oauth2Client.on('tokens', (tokens) => {
	console.log(tokens)
	if (tokens.refresh_token) {
		oauth2Client.setCredentials({
			refresh_token: `STORED_REFRESH_TOKEN`
		});
	}
	ytcode=tokens.access_token
});


// a simple sleep function. Should probably be in a module.
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



const app = express()
app.use(session({
	secret: crypto.randomBytes(32).toString('hex'),
	resave: false,
	saveUninitialized: true,
	cookie: { secure: true }
}))


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

app.get('/oauth', async (req,res)=>{
	if(!req.query.code){
		res.redirect('/init')
	}
	ytcode = req.query.code

	const { tokens } = await oauth2Client.getToken(ytcode);
	oauth2Client.setCredentials(tokens);
	
	console.log(ytcode)
	res.redirect('/golive')
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

async function TransitionStream(youtube, broadcastId, retry=0){
	await sleep(10000+(2000*retry))
	console.log("Attempting Stream Transition...")
	return youtube.liveBroadcasts.transition({
		part: 'id,status',
		id: broadcastId,
		broadcastStatus: 'live',
	})
	.then((res)=>{
		console.log(`Transitioned Stream after ${retry} attempts.`)
		return res
	})
	.catch(async (err)=>{
		console.log(`Stream Transition Failed. r=${retry}`)
		if(retry<10){
			return TransitionStream(youtube, broadcastId, retry+1)
		} else {
			console.log(`Failed to launch stream [${broadcastId}]`)
			throw new Error(err)
		}
	})
}

app.get('/golive/:camID', async (req,res)=>{
	if(!ytcode){
		res.redirect('/init')
		return
	}
	
	console.log("Initiating the Stream Process...")
	
	try {

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

		
		
		
		let StreamKey = streamResponse.data.cdn.ingestionInfo.streamName
		let Addr = streamResponse.data.cdn.ingestionInfo.ingestionAddress
		
		
		StartStream(StreamKey, Addr, req.params["camID"])
		console.log('FFMPEG is running');
		
		
		
		
		await TransitionStream(youtube, broadcastId)
		
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
	
	args = [
		'-loglevel', 'error',
		'-hwaccel', 'cuda',
		'-rtsp_transport', 'tcp',
		'-r', '25',
		'-i', Source,
		'-c:v', 'hevc_nvenc', 
		'-preset', 'fast',
		'-filter_complex', '"[0:v]hwupload_cuda,scale_cuda=1920:1080:format=yuv420p,fps=30"',
		'-g', '60',
		'-c:a', 'aac',
		'-f', 'flv',
		destination
    ]
	console.log(`Spawning FFMPEG ${args.join(" ")}`)
	proc = spawn('ffmpeg.exe', args);
	proc.stdout.on('data', (data) => {
		console.log(`FFMPEG o: ${data}`);
	});
	proc.stderr.on('data', function(data) {
        console.log(`FFMPEG e: ${data}`);
    });
	proc.on('close', (code) => {
		console.log(`FFMPEG process exited with code ${code}`);
	}); 
	
	
	if(proc.error) {
		console.warn("Error Launching FFMPEG")
		throw new Error(child.error);
	}
	
	return proc
}

const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);

httpServer.listen(8080, ()=>console.log("HTTP Server listening on port 8080"));
httpsServer.listen(8443, ()=>console.log("HTTPS Server listening on port 8443"));
