import { get } from "request-promise";
import * as Discord from "discord.js";

import {DISCORD_BOT_TOKEN, MARATHON_SLUG, DISCORD_BOT_ID, SUBMISSION_CHANNEL, DISCORD_GUILD} from "./config";

const seen_category_ids = [];
const OENGUS_URL = `https://oengus.io/api/marathon/${MARATHON_SLUG}/game`;

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

async function main() {
    const submissions = await getSubmissions();
    // get all category ids and save them
    submissions.forEach(submission => {
        submission.categories.forEach(cat => {
            seen_category_ids.push(cat.id);
        });
    });
    console.log(seen_category_ids);
    const discordClient = await loginBot();
    //const poggersEmoji = discordClient.guilds.get(DISCORD_GUILD).emojis.find(emoji => emoji.name == "Magoo");
    const channel = discordClient.channels.get(SUBMISSION_CHANNEL) as Discord.TextChannel;
    if (!channel) {
        throw new Error("channel doesn't exist!");
    }
    await formatSendSubmission(channel, "The Legend of Zelda: Skyward Sword", "Double Anti-Bingo", "Floha258", "Wii");
    channel.messages.forEach(message => {
        console.log(message);
        if (message.author.id == DISCORD_BOT_ID && message.embeds.length == 1) {
            const footer = message.embeds[0].footer;
            if (footer) {
                console.log(footer.text);
            }
        } 
    });
    await discordClient.destroy();
}

async function getSubmissions(): Promise<GameSubmission[]> {
    return await get(OENGUS_URL, {
        json: true,
    });
}

async function loginBot(): Promise<Discord.Client> {
    return new Promise((resolve, reject) => {
        const discordClient = new Discord.Client();
        try {
            discordClient.login(DISCORD_BOT_TOKEN);
            Promise.race([
                //30 sec timeout
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30 * 1000)),
                new Promise((resolve, _) => discordClient.on('ready',() => resolve())),
            ]).then(() => {
                resolve(discordClient);
            }).catch(e => {
                reject(e);
            });
        } catch(e) {
            reject(e);
        }
    });
}

function formatSendSubmission(channel: Discord.TextChannel, game: string, category: string, runner: string, platform: string): Promise<any> {
    return channel.send(`${runner} submitted a new run!`, {
        embed: {
            color: 0x5c88bc,
            description: `**Game**: ${game}\n**Category**: ${category}\n**Platform**: ${platform}`,
            footer: {text:`ID: 123`},
        }
    });
}

main();