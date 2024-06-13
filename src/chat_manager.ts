import { DMChannel, Message, ThreadChannel, type ChannelLogsQueryOptions, type TextBasedChannel } from "discord.js-selfbot-v13";
import { getReply, getReplyDM, type History } from "./groq.js";
import { userId } from "./index.js";

const greeting = `嗯...今天晚上該吃什麼好呢...啊，抱歉把你忽略了，我...我叫「凜雨澈」。(我慌張地說道) 話說，是什麼風把你吹來這的？`;

let chats = new Map<string, Chat>();

class Chat {
    channel: TextBasedChannel;
    history: History[];
    lastActive = Date.now();
    typing = false;

    constructor(channel: TextBasedChannel, history: History[]) {
        this.channel = channel;
        this.history = history;
        chats.set(channel.id, this);
        console.log(`registered channel ${channel.id}`)
    }

    async sendMessage(message: Message) {
        if (this.typing) return;

        this.typing = true;
        this.lastActive = Date.now();

        this.history.push({
            role: "user",
            content: `${message.author.displayName}: ${message.content}`
        });

        await this.channel.sendTyping();
        const reply = await getReply(this.history);

        if (reply.content) try {
            await message.reply(reply.content);
            this.history.push(reply);
            while (this.history.length > 30) {
                this.history.shift()
            }
        } catch (_) { }

        this.typing = false;
    }
    
    async sendMessageDM(message: Message) {
        if (this.typing) return;

        this.typing = true;
        this.lastActive = Date.now();

        this.history.push({
            role: "user",
            content: message.content
        });

        await this.channel.sendTyping();
        const reply = await getReplyDM(message.author.displayName, this.history);

        if (reply.content) try {
            await message.reply(reply.content);
            this.history.push(reply);
            while (this.history.length > 30) {
                this.history.shift()
            }
        } catch (_) { }

        this.typing = false;
    }
}

async function load(channel: ThreadChannel) {
    const owner = await channel.fetchOwner();
    if (owner?.id !== userId) return null;

    const starter = await channel.fetchStarterMessage();
    const messages = await channel.messages.fetch({ limit: 30, after: starter?.id } as ChannelLogsQueryOptions);
    const history: History[] = []

    for (const [, message] of messages) {
        if (message.content === "") continue;
        if (message.author.id === userId) {
            history.unshift({
                role: "assistant",
                content: message.content
            });
        } else if (!message.author.bot) {
            history.unshift({
                role: "user",
                content: `${message.author.displayName}: ${message.content}`
            });
        }
    }

    history.pop(); // the message that triggered this

    return new Chat(channel, history);
}

async function loadDM(channel: DMChannel) {
    const messages = await channel.messages.fetch({ limit: 30 });
    const history: History[] = [{
        role: "assistant",
        content: greeting
    }];

    for (const [, message] of messages) {
        if (message.content === "") continue;
        if (message.author.id === userId) {
            history.unshift({
                role: "assistant",
                content: message.content
            });
        } else if (!message.author.bot) {
            history.unshift({
                role: "user",
                content: `${message.author.displayName}: ${message.content}`
            });
        }
    }

    history.pop();

    return new Chat(channel, history);
}


async function get(channel: ThreadChannel) {
    return chats.get(channel.id) || await load(channel);
}

async function getDM(channel: DMChannel) {
    return chats.get(channel.id) || await loadDM(channel);
}

function remove(channel: ThreadChannel) {
    chats.delete(channel.id);
}

async function create(message: Message) {
    const thread = await message.startThread({ name: `嗨 ${message.author.displayName} :3` });
    
    await thread.send(greeting);
    new Chat(thread, [{
        role: "assistant",
        content: greeting
    }]);
}

function checkInactivity() {
    for (const [id, chat] of chats) {
        if (Date.now() - chat.lastActive > 180000) {
            chats.delete(id);
        }
    }
}

export default { Chat, get, create, remove, getDM, checkInactivity };
