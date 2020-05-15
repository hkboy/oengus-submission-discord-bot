import { get } from "request-promise";
import * as Discord from "discord.js";

import { DISCORD_BOT_TOKEN, MARATHON_SLUG, DISCORD_BOT_ID, SUBMISSION_CHANNEL, DISCORD_GUILD } from "./config";

const OENGUS_URL = `https://oengus.io/api/marathon/${MARATHON_SLUG}/game`;
const OENGUS_EVENT_URL = `https://oengus.io/api/marathon/${MARATHON_SLUG}`;
const SUBMITTED_URL = `https://oengus.io/marathon/${MARATHON_SLUG}/submissions`;
const FOOTER_ID_REGEX = /ID: ([0-9]+)/;
var getJSON = require('get-json');
var heleMinuten = false;
var geenUur = false;
var enkeleDigit = false;
let eventName = "";

interface Category {
  id: number,
  name: string,
  estimate: string,
  description: string,
  video: string,
}

interface User {
  id: number,
  username: string,
  twitchName: string,
  twitterName: string,
  speedruncomName: string,
}

interface GameSubmission {
  id: number,
  name: string,
  description: string,
  console: string,
  ratio: string,
  emulated: boolean,
  categories: Category[],
  user: User,
}

interface GameCategoryCombined {
  gameName: string,
  categoryName: string,
  userName: string,
  consoleName: string,
  gameDesc: string,
  catDesc: string,
  catId: number,
  estimate: string,
}

async function main() {
  await announceNotAlreadyPostedSubmissions();
  // look every 30 mins
  setInterval(() => {
    announceNotAlreadyPostedSubmissions();
  }, 10 * 60 * 1000);

}

async function getSubmissions(): Promise<GameSubmission[]> {
  return await get(OENGUS_URL, {
    json: true,
  });
}

function getEventName() {
  getJSON(OENGUS_EVENT_URL, function(error, response) {
    eventName = response.name;
  })
}

async function loginBot(): Promise<Discord.Client> {
  return new Promise((resolve, reject) => {
    const discordClient = new Discord.Client();
    try {
      discordClient.login(DISCORD_BOT_TOKEN);
      Promise.race([
        //30 sec timeout
        new Promise((_, reject) => setTimeout(() => {
          // if it's a timeout reject and destroy the client
          discordClient.destroy();
          reject(new Error('timeout'))
        }, 30 * 1000)),
        new Promise((resolve, _) => discordClient.on('ready', () => resolve())),
      ]).then(() => {
        resolve(discordClient);
      }).catch(e => {
        reject(e);
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function formatSendSubmission(channel: Discord.TextChannel, info: GameCategoryCombined): Promise<any> {
  info.estimate = changeTime(info);
  return channel.send({
    embed: {
      title: `${info.userName} submitted a new run!`,
      url: SUBMITTED_URL,
      color: 0x5c88bc,
      description: `**Event**: ` + eventName + `\n\n**Game**: ${info.gameName}\n**Category**: ${info.categoryName}\n**Platform**: ${info.consoleName}\n**Estimate:** ${info.estimate}`,
      footer: { text: `ID: ${info.catId}` },
    }
  });
}

function changeTime(info) {
  getEventName();
  console.log(info.estimate);
  var timeNow = "";
  timeNow = info.estimate;
  timeNow = parseDuration(timeNow);
  return timeNow;
}

function parseDuration(PT) {
  var output = [];
  var durationInSec = 0;
  var matches = PT.match(/P(?:(\d*)Y)?(?:(\d*)M)?(?:(\d*)W)?(?:(\d*)D)?T?(?:(\d*)H)?(?:(\d*)M)?(?:(\d*)S)?/i);
  var parts = [
    { // years
      pos: 1,
      multiplier: 86400 * 365
    },
    { // months
      pos: 2,
      multiplier: 86400 * 30
    },
    { // weeks
      pos: 3,
      multiplier: 604800
    },
    { // days
      pos: 4,
      multiplier: 86400
    },
    { // hours
      pos: 5,
      multiplier: 3600
    },
    { // minutes
      pos: 6,
      multiplier: 60
    },
    { // seconds
      pos: 7,
      multiplier: 1
    }
  ];

  for (var i = 0; i < parts.length; i++) {
    if (typeof matches[parts[i].pos] != 'undefined') {
      durationInSec += parseInt(matches[parts[i].pos]) * parts[i].multiplier;
    }
  }

  // Hours extraction
  if (durationInSec > 3599) {
    output.push(parseInt(durationInSec / 3600));
    durationInSec %= 3600;
  }
  // Minutes extraction with leading zero
  output.push(('0' + parseInt(durationInSec / 60)).slice(-2));
  // Seconds extraction with leading zero
  output.push(('0' + durationInSec % 60).slice(-2));

  return output.join(':');
};


async function getAlreadyAnnouncedCategoryIDs(channel: Discord.TextChannel): Promise<number[]> {
  let categoryIDs: number[] = [];
  let fetched = await channel.fetchMessages({ limit: 100 });
  while (fetched.size > 0) {
    fetched.forEach(message => {
      if (message.author.id == DISCORD_BOT_ID && message.embeds.length == 1) {
        const footer = message.embeds[0].footer;
        if (footer) {
          let match = FOOTER_ID_REGEX.exec(footer.text);
          if (match.length == 2) {
            categoryIDs.push(parseInt(match[1]));
          }
        }
      }
    });
    fetched = await channel.fetchMessages({ limit: 100, before: fetched.last().id });
  }
  return categoryIDs;
}

async function announceNotAlreadyPostedSubmissions(): Promise<void> {
  let discordClient: Discord.Client;
  try {
    discordClient = await loginBot();
  } catch (e) {
    console.error("Bot couldn't login!", e);
  }
  try {
    //const poggersEmoji = discordClient.guilds.get(DISCORD_GUILD).emojis.find(emoji => emoji.name == "Magoo");
    const channel = discordClient.channels.get(SUBMISSION_CHANNEL) as Discord.TextChannel;
    if (!channel) {
      throw new Error("channel doesn't exist!");
    }
    let [submissions, announcedCategoryIDs] = await Promise.all([getSubmissions(), getAlreadyAnnouncedCategoryIDs(channel)]);
    let unannounced: GameCategoryCombined[] = [];
    submissions.forEach(submission => {
      submission.categories.forEach(category => {
        if (!announcedCategoryIDs.includes(category.id)) {
          unannounced.push({
            catDesc: category.description,
            catId: category.id,
            categoryName: category.name,
            consoleName: submission.console,
            gameDesc: submission.description,
            gameName: submission.name,
            userName: submission.user.username,
            estimate: category.estimate,
          });
        }
      });
    });
    for (let i = 0; i < unannounced.length; i++) {
      await formatSendSubmission(channel, unannounced[i]);
    }
    console.log(`Announced ${unannounced.length} submissions!`);
  } catch (e) {
    console.error(e);
  } finally {
    discordClient.destroy();
  }
}

main();
