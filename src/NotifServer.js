const {FtpSrv, FileSystem} = require('ftp-srv');
const devnull = require('dev-null')({write:function(c,e,cb){cb()},destroy:function(err,cb){this.destroyed = true; return (cb ? cb() : null)}});
const schedule = require('node-schedule')
const axios = require('axios');

dnp = new Proxy(devnull, { // dnp - devnull proxy
	get(t, n, r){	// these attributes are used to trick Ftp-Srv that it is a writable socket/stream
		
		switch(n.toString()){
			case 'then':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case 'end':
				var value = t[n];
				console.log(value)
				return typeof value == 'function' ? value.bind(t) : value
			case 'path':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case '_writeOut':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case '_write':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case '_eventsCount':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case '_maxListeners':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case 'writableNeedDrain':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case 'destroy':
				var value = function(err, cb){this._destroy(null, cb); return this};
				console.log(`${t} | ${n.toString()} | ${value}`)
				return typeof value == 'function' ? value.bind(t) : value
			case '_destroy':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case '_final':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case 'write':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case 'writable':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case '_events':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case 'listenerCount':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case 'emit':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case 'on':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case 'once':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case 'prependListener':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case 'removeListener':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case '_writableState':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
			case '_readableState':
				return false
			case 'Symbol(shapeMode)':
				var value = t[n];
				return typeof value == 'function' ? value.bind(t) : value
		}
		console.debug(`unknown dnp get - [${n.toString()}]`) // if the ftp server is spitting socket or stream errors at you, this will help
		console.debug(t[n])
		var value = t[n];
		return typeof value == 'function' ? value.bind(t) : value
	}
	
})
	

class DummyFS extends FileSystem {
	constructor() {
		super()
	}

	get(fileName) {
		return {}
	}
	
	list(){
		return []
	}
	chdir(){
		return
	}
	mkdir(){
		return
	}
	write(){
		return {
			stream: dnp,
			clientPath: "//"
		}
	}
	read(){
		return {
			stream: dnp,
			clientPath: "//"
		}
	}
	delete(){
		return
	}
	rename(){
		return
	}
	chmod(){
		return
	}
	getUniqueName(){
		return "JohnDoe"
	}
}

class PulseHandler {
	static pulseTimeout = 1000 * 60 * 30 // 30 minutes (ms)
	static #Handles = []
	
	
	constructor (camName){
		this.lastPulse = new Date(-1)
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
		if(this.lastPulse.getTime() == new Date(-1).getTime()) {
			this.initPulse()
		}
		this.lastPulse = new Date()
	}
	
	initPulse(){
		console.log(`Received Initial Pulse from ${this.camName}`)
		axios.post(`http://localhost:8080/golive/${this.camName}`)
		.then((res)=>{
			//console.log(res)
			return
		})
		.catch((err)=>{
			//console.log(err)
			return
		})
		this.pulseCheck = schedule.scheduleJob('*/5 * * * *', PulseHandler.checkNeck.bind(null, this.camName));
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
		this.lastPulse = new Date(-1)
		this.pulseCheck.cancel()
	}
	
	static checkNeck(camName){
		let handle = PulseHandler.getHandle(camName)
		
		let timeDelt = (new Date()).getTime() - handle.lastPulse.getTime();
		
		if( timeDelt > PulseHandler.pulseTimeout ){
			handle.declareDead(timeDelt)
		}
	}
}

const port=21;
const ftpServer = new FtpSrv({
    url: "ftp://192.168.50.235:" + port,
	pasv_url: ()=>{return "192.168.50.235"},
	pasv_min: 5359,
	pasv_max: 5360,
	greeting: ['Howdy','Howdy']
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
		resolve({fs: new DummyFS()}) 
	}
    return reject(new errors.GeneralError('Request Type Not Permitted', 534));
});


ftpServer.listen().then(() => { 
    console.log('Ftp server is listening...')
});



exports.NotifServer = ftpServer

