const {FtpSrv, FileSystem} = require('ftp-srv');
const {PassThrough} = require('stream');
const schedule = require('node-schedule');
const axios = require('axios');
const bunyan = require('bunyan');
const pretty = require('@mechanicalhuman/bunyan-pretty');
const fs = require('fs');
const nodePath = require('path');



class DummyFS extends FileSystem {
	constructor() {
		super()
	}
	get(fileName) {
		return super.get("resources/NUFFIN.ATALL")
	}
	mkdir(){
		return
	}
	write(){
		let x = super.write("resources/NUFFIN.ATALL")
		let stream = new PassThrough()
		stream.once('close', () => stream.end());
		return {stream: stream, clientPath: "resources/NUFFIN.ATALL"}
	}
	read(FN){
		let x = super.read("resources/NUFFIN.ATALL")
		return {
			stream: new PassThrough(),
			clientPath: x.clientPath
		}
	}
	delete(){
		return
	}
	rename(){
		return 
	}
	chmod(){
		return Promise.resolve(true)
	}
	getUniqueName(){
		return "JohnDoe"
	}
}

function autoStreamable(camName, time){
	// we only do auto-streaming after 7pm, and only on camera 5
	// this function returns true or false, if the given camera name is allowed to start streaming at the given time
	// this could be made more complex, to allow for more cameras at more times.
	return ((camName == "PH_Pool_5") && (time.getHours() >= 19))
}

class PulseHandler {
	static pulseTimeout = 1000 * 60 * 30 // 30 minutes (ms)
	static #Handles = []
	
	
	constructor (camName){
		this.lastPulse = new Date(-1)
		this.up = false
		this.pulseCheck = null // when initPulse is called, this will be a scheduled job to make sure the cam pulses are live
		this.camName = camName
		PulseHandler.#Handles.push(this)
	}
	
	static getHandle(camName){
		for (i in PulseHandler.#Handles){
			if(PulseHandler.#Handles[i].camName == camName) {
				return PulseHandler.#Handles[i]
			}
		}
	}
	
	Pulse(){
		let rn = new Date()
		console.info(`Pulse recieved for camera ${this.camName}`)
		let ableToGoLive = autoStreamable(this.camName, rn)
		if ((!this.up) && ableToGoLive) {
			return this.initPulse()
		}
		console.debug(`Stream not initialized - up:${this.up} && aS?:${ableToGoLive}`)
		this.lastPulse = rn
	}
	
	initPulse(){
		let camObj = this
		console.log(`Starting autostream for ${camObj.camName}`)
		axios.post(`http://localhost:8080/golive/${camObj.camName}`, {title:"Nightly Pool Stream"})
		.then((res)=>{
			if(res.request._redirectable._redirectCount){ // if the request was redirected, there is likely no auth and the cam didnt go live
				console.warn("Failed to start Autostream - possibly not authed")
				return 
			} else {
				console.debug("Autostream Started")
				return
			}
		})
		.catch((err)=>{
			console.warn("init pulse err")
			console.dir(err)
			return
		})
	}
	
	setUp(){
		console.debug(`Created task to check ${this.camName}`)
		this.up = true
		this.pulseCheck = schedule.scheduleJob('*/5 * * * *', PulseHandler.checkNeck.bind(null, this.camName));
		// this schedule will run every 5th minute (00:05, 00:10, 00:15) 
	}
	
	declareDead(timeDelt){
		console.log(`Declaring ${this.camName} dead - ${timeDelt/1000/60}mins since last pulse`)
		axios.post(`http://localhost:8080/takedown/${this.camName}`)
		.then((res)=>{
			//console.log(res)
			return
		})
		.catch((err)=>{
			//console.log(err)
			return
		})
		this.up = false
		this.pulseCheck.cancel()
	}
	
	static checkNeck(camName){
		console.debug(`Checking the neck of camera ${camName}`)
		let handle = PulseHandler.getHandle(camName)
		
		let timeDelt = (new Date()).getTime() - handle.lastPulse.getTime();
		
		if( timeDelt > PulseHandler.pulseTimeout ){
			return handle.declareDead(timeDelt)
		} else {
			console.debug(`Pulse detected - ${timeDelt/1000/60}mins ago`)
		}
	}
}

const port=21;
const ftpServer = new FtpSrv({
    url: "ftp://192.168.50.45:" + port,
	greeting: ['Howdy','Howdy'],
	log: bunyan.createLogger({
        name: 'ftpsrv',
		stream: pretty(process.stdout),
        level: 'fatal'
    })
});

const camNumMap = { // a map of each camera's channel # to it's pulse handler
	"00": new PulseHandler("PH_Pool_6"),
	"01": new PulseHandler("PH_Pool_3"),
	"02": new PulseHandler("PH_Pool_5"),
	"03": new PulseHandler("PH_Pool_4"),
	"04": new PulseHandler("PH_Pool_7"),
	"05": new PulseHandler("PH_Pool_2"),
	"06": new PulseHandler("PH_Pool_1"),
	"07": new PulseHandler("PH_Pool_8")
}


ftpServer.on('login', ({ connection, username, password }, resolve, reject) => { 
	
	connection.on("STOR", (error, filePath) => {
		if(error){
			console.warn(error)
			
		} else {
			let camNum = String(filePath).split("_")[1] // the file name it tries to save is in the format `Pool Hall PH_##_20240810220255.jpg`
			let pulseHandle = camNumMap[camNum]			// the ## will correspond to the camera's channel on the NVR.
														// ive mapped the existing channel nums to the camera handles in camNameMap
														
			console.debug(`File Store Attempted - Motion Detected on camera ${pulseHandle.camName}`)
			pulseHandle.Pulse()
		}
	});
	
	if(username == 'superAdmin' && password === 'superPass'){
		return resolve({fs: new DummyFS()}) 
	} else {
		return reject(new errors.GeneralError('Bad Auth 534'));
	}
});

ftpServer.on('client-error', ({connection, context, error}) => { 
	console.warn("client error")
	console.dir(error)
});


ftpServer.listen().then(() => { 
    console.log(`Ftp server is listening on port ${port}...`)
});



exports.NotifServer = ftpServer
exports.PulseHandler = PulseHandler

