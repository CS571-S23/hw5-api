
import express from 'express';
import rateLimit from 'express-rate-limit';
import errorHandler from 'errorhandler';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import crypto from 'crypto';

import { readFileSync } from 'fs';

const app = express();
const port = 25405;

const COLE_LOCAL = false;
const FS_XID_ASSOCIATIONS = COLE_LOCAL ? "C:/Users/ColeNelson/Desktop/cs571-s23/hws/apis/hw5-api/secret-generation/ref-codes.secret" : "/secrets/ref-codes.secret";
const FS_MUSIC = COLE_LOCAL ? "C:/Users/ColeNelson/Desktop/cs571-s23/hws/apis/hw5-api/includes/music.json" : "/secrets/music.json";

// Generated using ChatGPT
const RAW_MUSIC_DATA = JSON.parse(readFileSync(FS_MUSIC).toString())
const MUSIC_DATA = RAW_MUSIC_DATA
    .reduce((prev, curr) => [...prev, ...curr["songs"]], [])
    .filter((v,i,a)=>a.findIndex(v2 => (v2.title === v.title)) === i)
    .map((song, i) => {
        return {
            ...song,
            img: `https://picsum.photos/seed/cs571-s23-${i}/200`,
            id: crypto.createHash('MD5').update(song.title).digest('hex')
        }
    })

const XID_ASSOCIATIONS = Object.fromEntries(readFileSync(FS_XID_ASSOCIATIONS)
    .toString().split(/\r?\n/g).map(assoc => {
        const assocArr = assoc.split(',');
        return [assocArr[1], assocArr[0]]
    })
);

const XIDS = Object.keys(XID_ASSOCIATIONS);

// LOGGING
app.use(morgan((tokens, req, res) => {
    return [
        tokens.date(),
        tokens['remote-addr'](req, res),
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        lookupXid(req.header('X-CS571-ID')),
        tokens['response-time'](req, res), 'ms'
    ].join(' ')
}));

morgan.token('date', function () {
    var p = new Date().toString().replace(/[A-Z]{3}\+/, '+').split(/ /);
    return (p[2] + '/' + p[1] + '/' + p[3] + ':' + p[4] + ' ' + p[5]);
});

process.on('uncaughtException', function (exception) {
    console.log(exception);
});

process.on('unhandledRejection', (reason, p) => {
    console.log("Unhandled Rejection at: Promise ", p, " reason: ", reason);
});

app.use(errorHandler({ dumpExceptions: true, showStack: true }));

// JSON Body Parser Configuration
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

// Request Throttler
app.set('trust proxy', 1);

// Allow CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-CS571-ID, Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Require WISC Badger ID
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        next();
    } else if (!req.header('X-CS571-ID')) {
        res.status(401).send({
            msg: "You must specify a header X-CS571-ID!"
        });
    } else if (!XIDS.includes(req.header('X-CS571-ID').toLowerCase())) {
        res.status(401).send({
            msg: "You specified an invalid X-CS571-ID!"
        });
    } else {
        next();
    }
});

// Throttling
app.use(rateLimit({
    message: {
        msg: "Too many requests, please try again later."
    },
    windowMs: 30 * 1000, // 30 seconds
    max: (req, res) => req.method === "OPTIONS" ? 0 : 100, // limit each client to 100 requests every 30 seconds
    keyGenerator: (req, res) => req.header('X-CS571-ID') // throttle on BID
}));

// Endpoints Go Here!
app.get('/api/songs', (req, res) => {
    res.set('Cache-Control', `public, max-age=60`).send(MUSIC_DATA);
});

// Error Handling
app.use((err, req, res, next) => {
    let datetime = new Date();
    let datetimeStr = `${datetime.toLocaleDateString()} ${datetime.toLocaleTimeString()}`;
    console.log(`${datetimeStr}: Encountered an error processing ${JSON.stringify(req.body)}`);
    res.status(500).send({
        "error-msg": "Oops! Something went wrong. Check to make sure that you are sending a valid request. Your recieved request is provided below. If it is empty, then it was most likely not provided or malformed. If you have verified that your request is valid, please contact the CS571 staff.",
        "error-req": JSON.stringify(req.body),
        "date-time": datetimeStr
    })
});

// XID Lookup
function lookupXid(xId) {
    if (XIDS.includes(xId)) {
        return XID_ASSOCIATIONS[xId];
    } else {
        return "anonymous"
    }
}

// Open Server for Business
app.listen(port, () => {
    console.log(`CS571 API :${port}`)
});
