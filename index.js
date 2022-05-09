const readline = require("readline");
const util = require("util");
const path = require("path");
const fs = require("fs");

const axios = require("axios").default;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = util.promisify(rl.question).bind(rl);

let ACCESS_TOKEN;

// INITIALIZATION FUNC
(async function init() {
  console.log(`>>> Hello 😃, This script will let you download all clips 
  of any number of streamers that are recorded in the last 24 hours
  just by giving the names of the streamers!`);

  const answer = await question(
    ">>> So, pls write the username of the streamers you want to get their clips: \n"
  );

  ACCESS_TOKEN = await getAccessToken();

  const streamersArr = answer.toLowerCase().split(" ");
  const clipsDataArr = [];

  for (let i = 0; i < streamersArr.length; i++) {
    const streamer = streamersArr[i];
    const clipsData = await getClipsData(streamer);

    if (clipsData && clipsData.length) {
      clipsDataArr.push([streamer, clipsData]);
    }
  }

  let clipsDir = path.resolve(__dirname, "twitchClips");

  if (!fs.existsSync(clipsDir)) {
    fs.mkdirSync(clipsDir);
  }

  for (let i = 0; i < clipsDataArr.length; i++) {
    const currClipsData = clipsDataArr[i];

    if (currClipsData[1].length) {
      console.log(`⌛ Downloading ${currClipsData[0]}'s clips... ⌛`);
      await downloadClips(currClipsData[0], currClipsData[1]);
      console.log("✅ Done ✅");
    }
  }

  rl.close();
})();

// Get Access Token Func
async function getAccessToken() {
  const { data } = await axios({
    method: "POST",
    url: "https://id.twitch.tv/oauth2/token",
    params: {
      client_id: "d8w5m3clso0jswub03e47q1ptb77w1",
      client_secret: "ohy64p1x9pq2sxsja6klpv6nd44n6m",
      grant_type: "client_credentials",
    },
  });

  return data.access_token;
}

// Get Streamer Id Func
async function getStreamerId(streamer) {
  const { data } = await axios({
    method: "GET",
    url: "https://api.twitch.tv/helix/users",
    params: {
      login: streamer,
    },
    headers: {
      "Client-Id": "d8w5m3clso0jswub03e47q1ptb77w1",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  });

  return data.data[0]?.id;
}

// Get Clips Data Func
async function getClipsData(streamer) {
  console.log(`⌛ Getting ${streamer}'s id... ⌛`);
  const streamerId = await getStreamerId(streamer);

  if (!streamerId) {
    console.log(`❌ No streamer id was found for ${streamer} ❌`);
    return;
  }
  console.log("✅ Done ✅");

  console.log(`⌛ Getting ${streamer}'s clips data... ⌛`);
  const { data } = await axios({
    method: "GET",
    url: "https://api.twitch.tv/helix/clips",
    params: {
      broadcaster_id: streamerId,
      first: 100,
      started_at: new Date(
        new Date().getTime() - 24 * 60 * 60 * 1000
      ).toISOString(),
      ended_at: new Date().toISOString(),
    },
    headers: {
      "Client-Id": "d8w5m3clso0jswub03e47q1ptb77w1",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  });

  if (!data.data.length) {
    console.log(`❌ No clip was found for ${streamer} in the last 24 hours ❌`);
  } else {
    console.log("✅ Done ✅");
  }

  return data.data;
}

// Download Clips Func
async function downloadClips(folderName, clipsData) {
  const parentDir = path.resolve(__dirname, "twitchClips", folderName);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir);
  }

  for (let i = 0; i < clipsData.length; i++) {
    const clip = clipsData[i];

    const savePath = path.resolve(parentDir, `${clip.id}.mp4`);

    if (fs.existsSync(savePath)) {
      continue;
    }

    const cutIndex = clip.thumbnail_url.indexOf("-preview");
    const downloadUrl = `${clip.thumbnail_url.substring(0, cutIndex)}.mp4`;

    const res = await axios({
      method: "GET",
      url: downloadUrl,
      responseType: "stream",
    });

    res.data.pipe(fs.createWriteStream(savePath));

    await new Promise((resolve, reject) => {
      res.data.on("end", () => {
        resolve();
      });

      res.data.on("error", (err) => {
        reject(err);
      });
    });
  }
}

// Interface Close Event Handler
rl.on("close", () => {
  console.log(">>> The script is terminated; Good bye!");
});

// Interface SIGINT Event Handler
rl.on("SIGINT", () => {
  rl.question(
    ">>> Are you sure you want to exit? (Type yes to exit) ",
    (answer) => {
      if (answer.match(/^y(es)?$/i)) {
        rl.pause();
        process.exit();
      }
    }
  );
});

// Internal Errors Handling
const UNKOWN_ERROR = `>>> Something went wrong ☹! Pls check your connection
 or contact the developer;`;

process.on("unhandledRejection", (_) => {
  console.log(UNKOWN_ERROR);
  process.exit(1);
});

process.on("uncaughtException", (_) => {
  console.log(UNKOWN_ERROR);
  process.exit(1);
});
