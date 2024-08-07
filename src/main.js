require('console-stamp')(console, 'HH:MM:ss.l');

const {google} = require('googleapis');
const crypto = require('crypto');
const { spawn } = require('node:child_process');
const {StreamManager} = require('src/StreamManager');

const express = require('express')
const session = require('express-session');
const axios = require('axios');

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
	if (tokens.refresh_token) {
		console.debug(`Tokens have refreshed`)
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
	
	res.redirect('/golive')
})

app.get('/golive', (req,res)=>{
	if(ytcode){
		res.render('ControlPanel.ejs', { Streams: StreamManager.getLiveStreams(), root: __dirname+"/../" })
	} else {
		res.redirect('/init')
	}
})

async function TransitionStream(youtube, broadcastId, retry=0){
	if(!youtube){youtube = google.youtube({ version: 'v3', auth: oauth2Client })}
	await sleep(45000+(2000*retry))
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
		console.log(err)
		
		if(retry<10){
			return TransitionStream(youtube, broadcastId, retry+1)
		} else {
			console.log(`Failed to launch stream [${broadcastId}]`)
			throw new Error(err)
		}
	})
}


app.get('/streamControl/:camName', async (req,res)=>{
	let camName = req.params["camName"]
	if(ytcode && camName){
		// check if the stream is live
		// if it is, send the youtube id.
		let isLive = StreamManager.isLive(camName)
		let id = null
		if(isLive){
			id = StreamManager.getStream(camName).id
		}
		
		res.render('StreamControl.ejs', { camName: camName, isLive: isLive, id: id, root: __dirname+"/../" })
	} else {
		res.redirect('/init')
	}
})

app.post('/golive/:camName', async (req,res)=>{
	if(!ytcode){
		res.redirect('/init')
		return
	}
	
	let camName = req.params["camName"]
	
	console.log("Initiating the Stream Process...")
	
	try {
		console.log("Testing Auth Token...")
		// Create live broadcast
		const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
		console.log("Auth Token OK")
		
		console.log("Creating Broadcast...")
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
		console.log("Successfully Created Broadcast")

		console.log("Creating Livestream...")
		// Create live stream
		const streamResponse = await youtube.liveStreams.insert({
		  part: 'snippet,cdn',
		  requestBody: {
			snippet: {
			  title: 'New Live Stream'
			},
			cdn: {
			  resolution: '720p',
			  ingestionType: 'rtmp',
			  frameRate:'30fps'
			}
		  }
		});

		const streamId = streamResponse.data.id;
		console.log("Successfully Creation Livestream")


		console.log("Binding Broadcast and Stream...")
		// Bind broadcast and stream
		await youtube.liveBroadcasts.bind({
		  part: 'id,contentDetails',
		  id: broadcastId,
		  streamId: streamId
		});
		console.log("Successfully Bound")
		
		
		
		let StreamKey = streamResponse.data.cdn.ingestionInfo.streamName
		let Addr = streamResponse.data.cdn.ingestionInfo.ingestionAddress
		
		
		console.log("Starting FFMPEG...")
		StreamManager.addStream(camName, broadcastId, await StartStream(StreamKey, Addr, camName))
		console.log('FFMPEG is running');
		
		
		
		const open = await import("open");
		chrome = await open.default(`https://studio.youtube.com/video/${broadcastId}/livestreaming`)
		
		console.log(`Stream Monitor ${broadcastId} is running`);
		
		console.log("Attempting Stream Transition in 45 seconds.")
		await TransitionStream(null, broadcastId)
		
		res.status(200).end()

		
	} 
	catch (error) {
		console.error('Error creating livestream:', error);
		res.status(500).send('Error creating livestream');
	}
})

app.post('/takedown/:camName', async (req,res)=>{ 	// might want to secure this - perhaps force a re-auth? 
	let camName = req.params["camName"]				// that would prevent people from stopping their own streams.
													// maybe dont let users do this - do it automatically after inactivity?
	if(!ytcode || !camName){	
		res.redirect('/init')
		return
	}
	console.log(`Request to Kill Stream on camera ${camName}`)
	StreamManager.killStream(camName)
	
	res.status(200).end()
})



async function StartStream(StreamKey, StreamAddr, camName){
	
	
	let Camera = StreamManager.getCamera(camName)
	let cam_ip = Camera.cam_ip
	let channel = Camera.channel
	
	
	SourceAddr = `rtsp://admin:spot9666@192.168.50.${cam_ip}:554/h264Preview_${channel}_main`
	
	destination = StreamAddr+'/'+StreamKey
	
	args = [
		'-loglevel', 'error',
		'-hwaccel', 'cuda',
		'-rtsp_transport', 'tcp',
		'-r', '25',
		'-i', SourceAddr,
		'-c:v', 'hevc_nvenc', 
		'-preset', 'fast',
		'-rc', 'vbr',
		'-filter_complex', "[0:v]hwupload_cuda,scale_cuda=1280:720:format=yuv420p,fps=60",
		'-g', '120',
		'-c:a', 'aac',
		'-f', 'flv',
		'-rtmp_buffer', '1000k',
		'-fps_mode', 'cfr',
		destination
    ]
	console.debug(`Spawning FFMPEG ${args.join(" ")}`)
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


app.get('/resources/:resource', (req, res) => {
	let ResourceName = req.params.resource
	console.debug(`[${req.ip}] Requested Resource ${ResourceName}`)
	res.sendFile(ResourceName, { root: __dirname+"/../resources" })
})

app.get('/snapshot/:camName', async (req,res)=>{
	let camName = req.params["camName"]
	console.log(`[${req.ip}] Requested Snapshpot from camera ${camName}`)
	
	let Camera = StreamManager.getCamera(camName)
	let cam_ip = Camera.cam_ip
	let snap_chan = Camera.snap_chan
	
	let imgAddr = `http://192.168.50.${cam_ip}/cgi-bin/api.cgi?cmd=Snap&channel=${snap_chan}&rs=idk_what_the_RS_is_For&user=admin&password=spot9666`
	
	const response = await axios.get(imgAddr, { responseType: "stream" })
	
	res.setHeader('Content-Type', 'image/jpeg')
	
	response.data.pipe(res)
	
})


const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);

httpServer.listen(8080, ()=>console.log("HTTP Server listening on port 8080"));
httpsServer.listen(8443, ()=>console.log("HTTPS Server listening on port 8443"));
