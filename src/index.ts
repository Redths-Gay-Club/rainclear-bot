import "dotenv/config"
import { Client } from "discord.js-selfbot-v13";
import chatManager from "./chat_manager.js";

const client = new Client({
    ws: {
        properties: {
            browser: "Discord iOS"
        }
    }
});
client.on("ready", async () => {
    console.log(`Logged in as ${client.user!.username}!`);
    setInterval(() => chatManager.checkInactivity(), 180000);
});
client.on("messageCreate", async message => {
    if (message.author.bot) return;
    switch (message.channel.type) {
        case "GUILD_TEXT":
            if (!message.mentions.users.has(userId)) return;
            chatManager.create(message);
            break;
        case "GUILD_PUBLIC_THREAD":
            const chat = await chatManager.get(message.channel);
            chat?.sendMessage(message);
            break;
        case "DM":
            if (message.channel.partial) return;
            if (message.author.id === userId) return;
            const chatDM = await chatManager.getDM(message.channel);
            chatDM?.sendMessage(message);
            break;
    }
});
client.on("threadDelete", thread => {
    chatManager.remove(thread);
});
await client.login(process.env.DISCORD_TOKEN);
const userId = client.user!.id;

export { userId };
