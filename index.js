const vad = require("@sentiment_technologies/vad-node");
const WebSocket = require('ws');
let ws_global;

function int16ToFloat32(inputArray) {
    const buffer = Buffer.from(inputArray);
    var output = new Float32Array(inputArray.length/2);
    for (var i = 0; i < inputArray.length; i += 2) {
        const sample = buffer.readInt16LE(i);
        const floatSample = sample / 32768.0;
        output[i / 2] = floatSample;
    }
    return output;
}

async function main() {
    let isSpeaking = false;
    let frame = [];

    const myvad = await vad.RealTimeVAD.new(16000, {
        onFrameProcessed: (probabilities) => {
            let currentlySpeaking = probabilities.isSpeech > 0.6;
            ws_global.send(JSON.stringify({
                event:'probabilities', 
                data: probabilities
            }))
            if (currentlySpeaking !== isSpeaking) {
                isSpeaking = currentlySpeaking;
                if(isSpeaking) {
                    ws_global.send(JSON.stringify({
                        event: 'started_speaking',
                        data: Math.random().toString().slice(0, 3)
                    }));
                } else {
                    ws_global.send(JSON.stringify({
                        event: 'stopped_speaking',
                        data: Math.random().toString().slice(0, 3)
                    }));
                }
            }
        },
        onVADMisfire: () => {
            console.log("VAD misfire");
        },
    });

    const sampleRate = 16000;
    const frameDuration =200; // milliseconds
    const frameSize = (sampleRate / 1000) * frameDuration;

    const wss = new WebSocket.Server({ port: 8080 });

    wss.on('connection', ws => {
        ws_global = ws
        ws.send(JSON.stringify({"connected":true}))
        console.log("connected")
        ws.on('message', async function (data) {
            // console.log(data)
            frame.push(...Array.from(data));
            while (frame.length >= frameSize) {
                const newBuffer = int16ToFloat32(new Uint8Array(frame.slice(0, frameSize)));
                await myvad.processAudio(newBuffer);
                frame = frame.slice(frameSize);
            }
        });

        ws.on('error', function (error) {
            console.log('Stream error: ', error);
        });
    });

    process.on('SIGINT', () => {
        console.log('Stopping WebSocket Server');
        wss.close();
    });
}

main();
